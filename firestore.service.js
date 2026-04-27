
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
    if (!snap.exists) return { total: 0, available: 0, unavailable: 0, unchecked: 0, totalPartitions: 1 };
    const d = snap.data();
    return {
      total:           d.total           || 0,
      available:       d.available       || 0,
      unavailable:     d.unavailable     || 0,
      unchecked:       d.unchecked       || 0,
      totalPartitions: d.totalPartitions || 1
    };
  }


  async uploadPins(pins, partitionSize = 500) {
    const BATCH_SIZE = 500;
    let uploaded = 0;
    const inc = firebase.firestore.FieldValue.increment;
    const totalPartitions = Math.max(1, Math.ceil(pins.length / partitionSize));

    for (let i = 0; i < pins.length; i += BATCH_SIZE) {
      const batch = this._db.batch();
      const chunk = pins.slice(i, i + BATCH_SIZE);
      for (let j = 0; j < chunk.length; j++) {
        const pin         = chunk[j];
        const globalIndex = i + j;
        const partitionId = Math.floor(globalIndex / partitionSize);
        const ref         = this._db.collection(this._collection).doc(pin);
        batch.set(ref, {
          pin,
          status:      "pending",
          available:   null,
          lockedBy:    null,
          lockedAt:    null,
          partitionId,
          createdAt:   firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
      batch.set(this._statsRef, { total: inc(chunk.length), unchecked: inc(chunk.length) }, { merge: true });
      await batch.commit();
      uploaded += chunk.length;
    }

    // Store totalPartitions in Firestore so all browsers can read it
    await this._statsRef.set({ totalPartitions }, { merge: true });

    return { uploaded, totalPartitions };
  }  async downloadPins(filter = "all") {
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

  async fetchAndLockBatch(workerId, token, batchSize = 5, partitionId = null) {
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${this._projectId}/databases/(default)/documents:runQuery`;
    const headers  = { "Content-Type": "application/json", ...this._authHeader(token) };

    // Build filter — partition-aware if partitionId provided
    const statusFilter = { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "pending" } } };
    const whereClause  = partitionId !== null
      ? {
          compositeFilter: {
            op: "AND",
            filters: [
              statusFilter,
              { fieldFilter: { field: { fieldPath: "partitionId" }, op: "EQUAL", value: { integerValue: String(partitionId) } } }
            ]
          }
        }
      : statusFilter;

    // Fetch exactly batchSize + small buffer — no over-fetch needed with updateTime lock
    const res = await fetch(queryUrl, {
      method: "POST", headers,
      body: JSON.stringify({
        structuredQuery: {
          from:  [{ collectionId: this._collection }],
          where: whereClause,
          limit: batchSize + 3
        }
      })
    });

    if (!res.ok) {
      console.warn("[PinService] Query failed:", res.status, await res.text().catch(() => ""));
      return [];
    }

    const results = await res.json();
    const candidates = results
      .filter(r => r.document)
      .map(r => {
        const fields     = r.document.fields || {};
        const parts      = r.document.name.split("/");
        const docId      = parts[parts.length - 1];
        const updateTime = r.document.updateTime;
        const status     = fields.status?.stringValue;
        const lockedBy   = fields.lockedBy?.stringValue;
        if (lockedBy || status === "done" || status === "processing") return null;
        return { docId, updateTime, pin: fields.pin?.stringValue || docId };
      })
      .filter(Boolean);

    console.log(`[PinService] Partition ${partitionId} — ${candidates.length} candidates, locking ${batchSize}...`);

    // Lock all candidates in parallel using updateTime precondition — no GET needed
    const lockResults = await Promise.all(
      candidates.map(doc => this._lockPin(doc.docId, doc.updateTime, workerId, token))
    );

    const locked = candidates.filter((_, i) => lockResults[i]).slice(0, batchSize);
    console.log(`[PinService] Locked ${locked.length} pins`);
    return locked;
  }

  /**
   * Conditional PATCH using updateTime precondition.
   * Firestore rejects with 400 if doc was modified since fetch — only one worker wins.
   * No GET needed — single HTTP call per pin.
   */
  async _lockPin(docId, updateTime, workerId, token) {
    if (!updateTime) return false;

    const url = `${this._baseUrl}/${encodeURIComponent(docId)}` +
      `?currentDocument.updateTime=${encodeURIComponent(updateTime)}` +
      `&updateMask.fieldPaths=status` +
      `&updateMask.fieldPaths=lockedBy` +
      `&updateMask.fieldPaths=lockedAt`;

    const res = await fetch(url, {
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

    // 200 = won, 400/409 = another worker got it first
    return res.ok;
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
