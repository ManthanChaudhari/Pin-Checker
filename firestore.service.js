
class PinService {
  constructor({ db = null, projectId, collection = "pins" } = {}) {
    this._db         = db;
    this._projectId  = projectId;
    this._collection = collection;
  }


  get _baseUrl() {
    return `https://firestore.googleapis.com/v1/projects/${this._projectId}/databases/(default)/documents/${this._collection}`;
  }

  _authHeader(token) {
    return token ? { "Authorization": `Bearer ${token}` } : {};
  }


  get _statsRef() {
    return this._db.collection("stats").doc("global");
  }

  async getStats() {
    const snap = await this._statsRef.get();
    if (!snap.exists) return { total: 0, available: 0, unavailable: 0, unchecked: 0 };
    const d = snap.data();
    return {
      total:       d.total       || 0,
      available:   d.available   || 0,
      unavailable: d.unavailable || 0,
      unchecked:   d.unchecked   || 0
    };
  }


  async uploadPins(pins) {
    const BATCH_SIZE = 500;
    let uploaded = 0;
    const inc = firebase.firestore.FieldValue.increment;
    for (let i = 0; i < pins.length; i += BATCH_SIZE) {
      const batch = this._db.batch();
      const chunk = pins.slice(i, i + BATCH_SIZE);
      for (const pin of chunk) {
        const ref = this._db.collection(this._collection).doc(pin);
        batch.set(ref, {
          pin,
          status:    "pending",
          available: null,
          lockedBy:  null,
          lockedAt:  null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
      // increment total + unchecked by chunk size in the same batch
      batch.set(this._statsRef, { total: inc(chunk.length), unchecked: inc(chunk.length) }, { merge: true });
      await batch.commit();
      uploaded += chunk.length;
    }
    return uploaded;
  }

  async downloadPins(filter = "all") {
    const snap = await this._db.collection(this._collection).get();
    return snap.docs
      .filter(d => {
        const val = d.data().available;
        if (filter === "available")   return val === true;
        if (filter === "unavailable") return val === false;
        if (filter === "unchecked")   return val === null || val === undefined;
        return true;
      })
      .map(d => {
        const val = d.data().available;
        const status = val === true ? "Available" : val === false ? "Unavailable" : "Unchecked";
        return { pin: d.data().pin || d.id, status };
      });
  }

  async deletePins(filter = "all") {
    const snap = await this._db.collection(this._collection).get();
    const toDelete = snap.docs.filter(d => {
      const val = d.data().available;
      if (filter === "available")   return val === true;
      if (filter === "unavailable") return val === false;
      if (filter === "unchecked")   return val === null || val === undefined;
      return true;
    });

    let dAvailable = 0, dUnavailable = 0, dUnchecked = 0;
    toDelete.forEach(d => {
      const val = d.data().available;
      if (val === true)       dAvailable++;
      else if (val === false) dUnavailable++;
      else                    dUnchecked++;
    });

    const BATCH_SIZE = 500;
    for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
      const batch = this._db.batch();
      toDelete.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    if (toDelete.length > 0) {
      const inc = firebase.firestore.FieldValue.increment;
      await this._statsRef.set({
        total:       inc(-toDelete.length),
        available:   inc(-dAvailable),
        unavailable: inc(-dUnavailable),
        unchecked:   inc(-dUnchecked)
      }, { merge: true });
    }

    return toDelete.length;
  }

  async fetchAndLockBatch(workerId, token, batchSize = 5) {
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${this._projectId}/databases/(default)/documents:runQuery`;
    const headers  = { "Content-Type": "application/json", ...this._authHeader(token) };
    const fetchLimit = batchSize * 6; // over-fetch more to survive races

    // Query 1: docs with status == "pending"
    const [res1, res2] = await Promise.all([
      fetch(queryUrl, {
        method: "POST", headers,
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: this._collection }],
            where: { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "pending" } } },
            limit: fetchLimit
          }
        })
      }),
      // Query 2: legacy docs — available is null AND no lockedBy (not yet migrated)
      fetch(queryUrl, {
        method: "POST", headers,
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: this._collection }],
            where: {
              compositeFilter: {
                op: "AND",
                filters: [
                  { fieldFilter: { field: { fieldPath: "available" }, op: "EQUAL", value: { nullValue: null } } }
                ]
              }
            },
            limit: fetchLimit
          }
        })
      })
    ]);

    const parseResults = async (res) => {
      if (!res.ok) {
        console.warn("[PinService] Query failed:", res.status, await res.text().catch(() => ""));
        return [];
      }
      const results = await res.json();
      return results
        .filter(r => r.document)
        .map(r => {
          const fields   = r.document.fields || {};
          const parts    = r.document.name.split("/");
          const docId    = parts[parts.length - 1];
          const status   = fields.status?.stringValue;
          const lockedBy = fields.lockedBy?.stringValue;
          // Skip already locked or done
          if (lockedBy || status === "done" || status === "processing") return null;
          return { docId, pin: fields.pin?.stringValue || docId };
        })
        .filter(Boolean);
    };

    const [list1, list2] = await Promise.all([parseResults(res1), parseResults(res2)]);

    // Merge and deduplicate by docId
    const seen = new Set();
    const candidates = [...list1, ...list2].filter(d => {
      if (seen.has(d.docId)) return false;
      seen.add(d.docId);
      return true;
    });

    console.log(`[PinService] Found ${candidates.length} candidates, attempting to lock ${batchSize}...`);

    // Atomically lock each doc — try up to 2x batchSize to handle races
    const locked = [];
    const maxAttempts = Math.min(candidates.length, batchSize * 2);
    
    for (let i = 0; i < maxAttempts && locked.length < batchSize; i++) {
      const doc = candidates[i];
      const ok = await this._lockPin(doc.docId, workerId, token);
      if (ok) {
        locked.push(doc);
        console.log(`[PinService] Locked ${doc.docId.slice(0, 8)}...`);
      }
    }

    console.log(`[PinService] Successfully locked ${locked.length} pins`);
    return locked;
  }

  /**
   * Optimistic lock: PATCH the doc with our workerId, then verify we won.
   * Returns true if we successfully locked it, false if another worker beat us.
   */
  async _lockPin(docId, workerId, token) {
    const url = `${this._baseUrl}/${encodeURIComponent(docId)}` +
      `?updateMask.fieldPaths=status&updateMask.fieldPaths=lockedBy&updateMask.fieldPaths=lockedAt`;

    // Step 1: PATCH to claim the lock
    const patchRes = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...this._authHeader(token) },
      body: JSON.stringify({
        fields: {
          status:   { stringValue: "processing" },
          lockedBy: { stringValue: workerId },
          lockedAt: { integerValue: String(Date.now()) }
        }
      })
    });

    if (!patchRes.ok) {
      console.warn("[PinService] PATCH lock failed:", patchRes.status);
      return false;
    }

    // Step 2: immediately re-read to verify we won the race
    const getRes = await fetch(`${this._baseUrl}/${encodeURIComponent(docId)}`, {
      headers: this._authHeader(token)
    });

    if (!getRes.ok) return false;

    const doc = await getRes.json();
    const actualLockedBy = doc.fields?.lockedBy?.stringValue;

    // If lockedBy matches our workerId, we won. Otherwise another worker overwrote us.
    return actualLockedBy === workerId;
  }

  async updatePinDone(docId, available, token) {
    const url = `${this._baseUrl}/${encodeURIComponent(docId)}` +
      `?updateMask.fieldPaths=status&updateMask.fieldPaths=available&updateMask.fieldPaths=lockedBy&updateMask.fieldPaths=lockedAt`;

    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...this._authHeader(token) },
      body: JSON.stringify({
        fields: {
          status:    { stringValue: "done" },
          available: { booleanValue: available },
          lockedBy:  { nullValue: null },
          lockedAt:  { nullValue: null }
        }
      })
    });

    if (!res.ok) throw new Error(`Firestore REST error ${res.status}: ${await res.text()}`);

    // increment available or unavailable by 1, decrement unchecked by 1
    const statsField = available ? "available" : "unavailable";
    await fetch(
      `https://firestore.googleapis.com/v1/projects/${this._projectId}/databases/(default)/documents:commit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this._authHeader(token) },
        body: JSON.stringify({
          writes: [{
            transform: {
              document: `projects/${this._projectId}/databases/(default)/documents/stats/global`,
              fieldTransforms: [
                { fieldPath: "unchecked",  increment: { integerValue: "-1" } },
                { fieldPath: statsField,   increment: { integerValue: "1"  } }
              ]
            }
          }]
        })
      }
    ).catch(e => console.warn("[PinService] stats update failed:", e));

    return true;
  }


  async reclaimStalePins(token, timeoutMs = 5 * 60 * 1000) {
    const cutoff = Date.now() - timeoutMs;
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${this._projectId}/databases/(default)/documents:runQuery`;

    const res = await fetch(queryUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this._authHeader(token) },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: this._collection }],
          where: {
            compositeFilter: {
              op: "AND",
              filters: [
                { fieldFilter: { field: { fieldPath: "status" },   op: "EQUAL",     value: { stringValue: "processing" } } },
                { fieldFilter: { field: { fieldPath: "lockedAt" }, op: "LESS_THAN", value: { integerValue: String(cutoff) } } }
              ]
            }
          }
        }
      })
    });

    if (!res.ok) return 0;
    const results = await res.json();
    const stale = results.filter(r => r.document);
    let reclaimed = 0;

    for (const r of stale) {
      const parts = r.document.name.split("/");
      const docId = parts[parts.length - 1];
      try {
        const patchUrl = `${this._baseUrl}/${encodeURIComponent(docId)}` +
          `?updateMask.fieldPaths=status&updateMask.fieldPaths=lockedBy&updateMask.fieldPaths=lockedAt`;
        const patchRes = await fetch(patchUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...this._authHeader(token) },
          body: JSON.stringify({
            fields: {
              status:   { stringValue: "pending" },
              lockedBy: { nullValue: null },
              lockedAt: { nullValue: null }
            }
          })
        });
        if (patchRes.ok) reclaimed++;
      } catch (_) {}
    }
    return reclaimed;
  }

  async updatePinAvailability(docId, available, token) {
    return this.updatePinDone(docId, available, token);
  }
}
