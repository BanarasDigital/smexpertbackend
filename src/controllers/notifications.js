import DeviceToken from "../model/DeviceToken.js";
import { sendToToken } from "../utils/fcmClient.js";

/** Save token or update projectId */
export async function saveToken(req, res) {
  try {
    const { token, projectId, platform, meta } = req.body;
    if (!token || !projectId) {
      return res.status(400).json({ error: "token, projectId required" });
    }

    const upsert = await DeviceToken.findOneAndUpdate(
      { token },
      {
        $set: {
          projectId,
          platform: platform || "android",
          meta: meta || {},
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ success: true, doc: upsert });
  } catch (err) {
    console.error("saveToken error:", err);
    return res.status(500).json({ error: err.message });
  }
}

/** Send push to all devices under projectId */
export async function sendByProjectId(req, res) {
  try {
    const { projectId, title, message, data } = req.body;

    if (!projectId || !title || !message) {
      return res.status(400).json({
        error: "projectId, title, message required",
      });
    }

    const tokens = await DeviceToken.find({ projectId });

    const results = [];

    for (const t of tokens) {
      t.badge = (t.badge || 0) + 1;
      await t.save();

      // ✅ DATA ONLY (CRITICAL)
      const payload = {
        data: {
          title,
          body: message,
          badge: String(t.badge),
          ...(data || {}),
        },
      };

      const r = await sendToToken(t.token, payload);
      results.push(r);
    }

    return res.json({
      success: true,
      sent: results.length,
    });
  } catch (err) {
    console.error("sendByProjectId error:", err);
    return res.status(500).json({ error: err.message });
  }
}


/** Reset badge for device token */
export async function resetBadge(req, res) {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "token required" });
    }

    const doc = await DeviceToken.findOne({ token });
    if (!doc) {
      return res.status(404).json({ error: "token not found" });
    }

    doc.badge = 0;
    await doc.save();

    return res.json({ success: true });
  } catch (err) {
    console.error("resetBadge error:", err);
    return res.status(500).json({ error: err.message });
  }
}
