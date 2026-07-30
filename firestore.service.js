/**
 * PinService — Packed Documents Model
 * 
 * Instead of 1 Firestore doc per pin, we store ~200 pins per document.
 * Collection: "pinBatches" — each doc has structure:
 *   { partitionId, batchIndex, pins: [ { pin, status, available, category } ] }
 * 
 * This reduces Firestore operations by ~200x for uploads/reads/deletes.
 */

class PinService {
  constructor({ db = null, projectId, collection = "pinBatches" } = {}) {
    this._db         = db;
    this._projectId  = projectId;
    this._collection = collection;
    this._pinsPerDoc = 200; // max pins packed per document
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

  // ─── Stats ────────────────────────────────────────────────────────────────────

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

  // ─── Upload (popup, uses Firestore SDK) ───────────────────────────────────────

  async uploadPins(pins, partitionSize = 500) {
    const totalPartitions = Math.max(1, Math.ceil(pins.length / partitionSize));
    const BATCH_LIMIT = 500; // Firestore batch write limit
    let uploaded = 0;

    // Group pins into packed documents
    const docs = [];
    for (let i = 0; i < pins.length; i++) {
      const partitionId = Math.floor(i / partitionSize);
      const localIndex  = i % partitionSize;
      const batchIndex  = Math.floor(localIndex / this._pinsPerDoc);
      const docKey      = `batch_${partitionId}_${batchIndex}`;

      let doc = docs.find(d => d.id === docKey);
      if (!doc) {
        doc = { id: docKey, partitionId, batchIndex, pins: [] };
        docs.push(doc);
      }
      doc.pins.push({ pin: pins[i], status: "pending", available: null, category: "" });
    }

    // Write docs in Firestore batches (max 500 operations per batch)
    const inc = firebase.firestore.FieldValue.increment;
    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const batch = this._db.batch();
      const chunk = docs.slice(i, i + BATCH_LIMIT);
      for (const doc of chunk) {
        const ref = this._db.collection(this._collection).doc(doc.id);
        batch.set(ref, {
          partitionId: doc.partitionId,
          batchIndex:  doc.batchIndex,
          pins:        doc.pins,
          createdAt:   firebase.firestore.FieldValue.serverTimestamp()
        });
        uploaded += doc.pins.length;
      }
      // Update stats with this chunk's pin count
      const chunkPinCount = chunk.reduce((sum, d) => sum + d.pins.length, 0);
      batch.set(this._statsRef, { total: inc(chunkPinCount), unchecked: inc(chunkPinCount) }, { merge: true });
      await batch.commit();
    }

    // Store totalPartitions
    await this._statsRef.set({ totalPartitions }, { merge: true });

    return { uploaded, totalPartitions };
  }

  // ─── Download (popup, uses Firestore SDK) ─────────────────────────────────────

  async downloadPins(filter = "all") {
    const snap = await this._db.collection(this._collection).get();
    const results = [];
    snap.docs.forEach(doc => {
      const data = doc.data();
      if (!data.pins || !Array.isArray(data.pins)) return;
      data.pins.forEach(p => {
        if (filter === "available"   && p.available !== true)  return;
        if (filter === "unavailable" && p.available !== false) return;
        if (filter === "unchecked"   && p.available !== null && p.available !== undefined) return;
        const status = p.available === true ? "Available" : p.available === false ? "Unavailable" : "Unchecked";
        results.push({ pin: p.pin, status, category: p.category || "" });
      });
    });
    return results;
  }

  // ─── Delete (popup, uses Firestore SDK) ────────────────────────────────────────

  async deletePins(filter = "all") {
    const snap = await this._db.collection(this._collection).get();
    let totalDeleted = 0;
    let dAvailable = 0, dUnavailable = 0, dUnchecked = 0;

    const BATCH_LIMIT = 500;
    const writeBatch = this._db.batch();
    let batchCount = 0;

    for (const doc of snap.docs) {
      const data = doc.data();
      if (!data.pins || !Array.isArray(data.pins)) continue;

      if (filter === "all") {
        // Delete entire doc
        data.pins.forEach(p => {
          totalDeleted++;
          if (p.available === true) dAvailable++;
          else if (p.available === false) dUnavailable++;
          else dUnchecked++;
        });
        writeBatch.delete(doc.ref);
        batchCount++;
      } else {
        // Filter pins, keep non-matching ones
        const keep = [];
        const remove = [];
        data.pins.forEach(p => {
          const matches = (filter === "available" && p.available === true) ||
                          (filter === "unavailable" && p.available === false) ||
                          (filter === "unchecked" && (p.available === null || p.available === undefined));
          if (matches) remove.push(p);
          else keep.push(p);
        });

        if (remove.length === 0) continue;

        remove.forEach(p => {
          totalDeleted++;
          if (p.available === true) dAvailable++;
          else if (p.available === false) dUnavailable++;
          else dUnchecked++;
        });

        if (keep.length === 0) {
          writeBatch.delete(doc.ref);
        } else {
          writeBatch.update(doc.ref, { pins: keep });
        }
        batchCount++;
      }

      // Commit if approaching batch limit
      if (batchCount >= BATCH_LIMIT) {
        await writeBatch.commit();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await writeBatch.commit();
    }

    // Update stats
    if (filter === "all") {
      await this._statsRef.set({ total: 0, available: 0, unavailable: 0, unchecked: 0, totalPartitions: 1 });
    } else if (totalDeleted > 0) {
      const inc = firebase.firestore.FieldValue.increment;
      await this._statsRef.set({
        total:       inc(-totalDeleted),
        available:   inc(-dAvailable),
        unavailable: inc(-dUnavailable),
        unchecked:   inc(-dUnchecked)
      }, { merge: true });
    }

    return totalDeleted;
  }

  // ─── Fetch pending pins for a partition (content script, uses REST API) ───────

  async fetchPartitionPins(token, partitionId) {
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${this._projectId}/databases/(default)/documents:runQuery`;
    const headers  = { "Content-Type": "application/json", ...this._authHeader(token) };

    // Query all batch docs for this partition
    const whereClause = partitionId !== null
      ? { fieldFilter: { field: { fieldPath: "partitionId" }, op: "EQUAL", value: { integerValue: String(partitionId) } } }
      : undefined;

    const structuredQuery = {
      from: [{ collectionId: this._collection }]
    };
    if (whereClause) structuredQuery.where = whereClause;

    const res = await fetch(queryUrl, {
      method: "POST", headers,
      body: JSON.stringify({ structuredQuery })
    });

    if (!res.ok) {
      console.warn("[PinService] fetchPartitionPins failed:", res.status, await res.text().catch(() => ""));
      return [];
    }

    const results = await res.json();
    const pendingPins = [];

    results.filter(r => r.document).forEach(r => {
      const fields = r.document.fields || {};
      const parts  = r.document.name.split("/");
      const docId  = parts[parts.length - 1];

      // Parse the pins array from Firestore REST format
      const pinsArray = fields.pins?.arrayValue?.values || [];
      pinsArray.forEach((pinEntry, index) => {
        const mapFields = pinEntry.mapValue?.fields || {};
        const status    = mapFields.status?.stringValue;
        const pin       = mapFields.pin?.stringValue;
        if (status === "pending" && pin) {
          pendingPins.push({ docId, pinIndex: index, pin });
        }
      });
    });

    return pendingPins;
  }

  // ─── Update a single pin's result in its batch doc (content script, REST API) ─

  async updatePinDone(docId, pinIndex, available, token, category = "") {
    // Read the batch doc
    const getUrl = `${this._baseUrl}/${encodeURIComponent(docId)}`;
    const headers = { "Content-Type": "application/json", ...this._authHeader(token) };

    const getRes = await fetch(getUrl, { method: "GET", headers });
    if (!getRes.ok) throw new Error(`Firestore GET error ${getRes.status}`);

    const docData = await getRes.json();
    const pinsArray = docData.fields?.pins?.arrayValue?.values || [];

    // Update the specific pin at pinIndex
    if (pinsArray[pinIndex]) {
      pinsArray[pinIndex].mapValue.fields.status    = { stringValue: "done" };
      pinsArray[pinIndex].mapValue.fields.available = { booleanValue: available };
      pinsArray[pinIndex].mapValue.fields.category  = { stringValue: category };
    }

    // Write back the full pins array
    const patchUrl = `${this._baseUrl}/${encodeURIComponent(docId)}?updateMask.fieldPaths=pins`;
    const patchRes = await fetch(patchUrl, {
      method: "PATCH", headers,
      body: JSON.stringify({
        fields: { pins: { arrayValue: { values: pinsArray } } }
      })
    });

    if (!patchRes.ok) throw new Error(`Firestore PATCH error ${patchRes.status}: ${await patchRes.text()}`);

    // Update stats atomically
    const statsField = available ? "available" : "unavailable";
    await fetch(
      `https://firestore.googleapis.com/v1/projects/${this._projectId}/databases/(default)/documents:commit`,
      {
        method: "POST", headers,
        body: JSON.stringify({
          writes: [{
            transform: {
              document: `projects/${this._projectId}/databases/(default)/documents/stats/global`,
              fieldTransforms: [
                { fieldPath: "unchecked", increment: { integerValue: "-1" } },
                { fieldPath: statsField,  increment: { integerValue: "1" } }
              ]
            }
          }]
        })
      }
    ).catch(e => console.warn("[PinService] stats update failed:", e));

    return true;
  }

  // ─── Batch update: mark multiple pins done in one doc (reduces writes) ────────

  async updateBatchDoc(docId, updates, token) {
    // updates: [{ pinIndex, available, category }]
    const getUrl = `${this._baseUrl}/${encodeURIComponent(docId)}`;
    const headers = { "Content-Type": "application/json", ...this._authHeader(token) };

    const getRes = await fetch(getUrl, { method: "GET", headers });
    if (!getRes.ok) throw new Error(`Firestore GET error ${getRes.status}`);

    const docData = await getRes.json();
    const pinsArray = docData.fields?.pins?.arrayValue?.values || [];

    let availableCount = 0, unavailableCount = 0;

    for (const u of updates) {
      if (pinsArray[u.pinIndex]) {
        pinsArray[u.pinIndex].mapValue.fields.status    = { stringValue: "done" };
        pinsArray[u.pinIndex].mapValue.fields.available = { booleanValue: u.available };
        pinsArray[u.pinIndex].mapValue.fields.category  = { stringValue: u.category || "" };
        if (u.available) availableCount++;
        else unavailableCount++;
      }
    }

    // Write back
    const patchUrl = `${this._baseUrl}/${encodeURIComponent(docId)}?updateMask.fieldPaths=pins`;
    const patchRes = await fetch(patchUrl, {
      method: "PATCH", headers,
      body: JSON.stringify({
        fields: { pins: { arrayValue: { values: pinsArray } } }
      })
    });

    if (!patchRes.ok) throw new Error(`Firestore PATCH error ${patchRes.status}`);

    // Update stats
    const transforms = [
      { fieldPath: "unchecked", increment: { integerValue: String(-updates.length) } }
    ];
    if (availableCount > 0) {
      transforms.push({ fieldPath: "available", increment: { integerValue: String(availableCount) } });
    }
    if (unavailableCount > 0) {
      transforms.push({ fieldPath: "unavailable", increment: { integerValue: String(unavailableCount) } });
    }

    await fetch(
      `https://firestore.googleapis.com/v1/projects/${this._projectId}/databases/(default)/documents:commit`,
      {
        method: "POST", headers,
        body: JSON.stringify({
          writes: [{ transform: {
            document: `projects/${this._projectId}/databases/(default)/documents/stats/global`,
            fieldTransforms: transforms
          }}]
        })
      }
    ).catch(e => console.warn("[PinService] stats batch update failed:", e));

    return true;
  }
}
