/**
 * PinService — all Firestore operations for pins.
 * SDK mode  (popup.js)   : pass { db, projectId }
 * REST mode (content.js) : pass { projectId } only
 */
class PinService {
  constructor({ db = null, projectId, collection = "pins" } = {}) {
    this._db         = db;
    this._projectId  = projectId;
    this._collection = collection;
  }

  // ─── SDK methods ─────────────────────────────────────────────────────────

  /** Fetch all pins where available is null (unchecked) */
  async getUncheckedPins() {
    const snap = await this._db.collection(this._collection).get();
    // Firestore can't query for null directly, so filter client-side
    return snap.docs
      .filter(d => d.data().available === null || d.data().available === undefined)
      .map(d => ({ docId: d.id, pin: d.data().pin || d.id }));
  }

  /** Stats: total, unchecked (null), available (true), unavailable (false) */
  async getStats() {
    const snap = await this._db.collection(this._collection).get();
    let total = 0, available = 0, unavailable = 0, unchecked = 0;
    snap.docs.forEach(d => {
      total++;
      const val = d.data().available;
      if (val === true)       available++;
      else if (val === false) unavailable++;
      else                    unchecked++;   // null / undefined
    });
    return { total, available, unavailable, unchecked };
  }

  /**
   * Upload pins — stored with available: null (not yet checked).
   * Uses merge:false on the available field so re-uploads don't reset checked pins.
   */
  async uploadPins(pins) {
    const BATCH_SIZE = 500;
    let uploaded = 0;
    for (let i = 0; i < pins.length; i += BATCH_SIZE) {
      const batch = this._db.batch();
      const chunk = pins.slice(i, i + BATCH_SIZE);
      for (const pin of chunk) {
        const ref = this._db.collection(this._collection).doc(pin);
        // Only set available:null if the doc doesn't exist yet (merge keeps existing status)
        batch.set(ref, {
          pin,
          available: null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
      await batch.commit();
      uploaded += chunk.length;
    }
    return uploaded;
  }

  /** Download pins filtered by status — returns array of { pin, status } */
  async downloadPins(filter = "all") {
    const snap = await this._db.collection(this._collection).get();
    return snap.docs
      .filter(d => {
        const val = d.data().available;
        if (filter === "available")   return val === true;
        if (filter === "unavailable") return val === false;
        if (filter === "unchecked")   return val === null || val === undefined;
        return true; // "all"
      })
      .map(d => {
        const val = d.data().available;
        const status = val === true ? "Available" : val === false ? "Unavailable" : "Unchecked";
        return { pin: d.data().pin || d.id, status };
      });
  }

  // ─── REST method (content.js — no SDK) ───────────────────────────────────

  /** Delete pins by filter: "all" | "available" | "unavailable" | "unchecked" */
  async deletePins(filter = "all") {
    const snap = await this._db.collection(this._collection).get();
    const toDelete = snap.docs.filter(d => {
      const val = d.data().available;
      if (filter === "available")   return val === true;
      if (filter === "unavailable") return val === false;
      if (filter === "unchecked")   return val === null || val === undefined;
      return true; // "all"
    });

    const BATCH_SIZE = 500;
    for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
      const batch = this._db.batch();
      toDelete.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    return toDelete.length;
  }

  /**
   * Update available field via Firestore REST API.
   * @param {string}  docId
   * @param {boolean} available  — true or false
   * @param {string}  token      — Firebase Auth ID token
   */
  async updatePinAvailability(docId, available, token) {
    const url = [
      `https://firestore.googleapis.com/v1/projects/${this._projectId}`,
      `/databases/(default)/documents/${this._collection}/${encodeURIComponent(docId)}`,
      `?updateMask.fieldPaths=available`
    ].join("");

    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        fields: { available: { booleanValue: available } }
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Firestore REST error ${res.status}: ${err}`);
    }
    return true;
  }
}
