import DeviceToken from "../model/DeviceToken.js";
import LeadModel from "../model/lead.model.js";
import ExcelJS from "exceljs";
import { sendToToken } from "../utils/fcmClient.js";
async function notifyLeadUsers({
  lead,
  title,
  body,
  data,
  notifyAdmins = true,
  notifyAssigned = true,
}) {
  try {
    const tokenSet = new Set();

    const assignedUserId =
      lead?.assignedTo?._id ||
      lead?.assignedTo ||
      null;

    if (notifyAssigned && assignedUserId) {
      const userTokens = await DeviceToken.find({
        "meta.userId": assignedUserId.toString(),
      }).lean();

      for (const t of userTokens) {
        if (t?.token) tokenSet.add(t.token);
      }
    }

    if (notifyAdmins) {
      const adminTokens = await DeviceToken.find({
        "meta.userType": "admin",
      }).lean();

      for (const t of adminTokens) {
        if (t?.token) tokenSet.add(t.token);
      }
    }

    for (const token of tokenSet) {
      await sendToToken(token, {
        data: {
          title,
          body,
          ...data,
        },
        android: { priority: "high" },
      });
    }
  } catch (err) {
    console.error("notifyLeadUsers error:", err.message);
  }
}




function normalizeAssignedTo(assignedTo) {
  if (
    !assignedTo ||
    assignedTo === "" ||
    assignedTo === null ||
    assignedTo === undefined ||
    (Array.isArray(assignedTo) && assignedTo.length === 0) ||
    (typeof assignedTo === "object" && !Array.isArray(assignedTo) && Object.keys(assignedTo).length === 0) ||
    (typeof assignedTo === "object" && !Array.isArray(assignedTo) && assignedTo._id === undefined)
  ) {
    return null;
  }
  return assignedTo;
}

// ➤ CREATE LEAD
// export async function createLead(req, res) {
//   try {
//     const lead = await LeadModel.create({
//       ...req.body,
//       createdBy: req.user._id,
//     });

//     res.status(201).json({ success: true, lead });
//   } catch (err) {
//     res.status(400).json({ success: false, message: err.message });
//   }
// }
// export async function createLead(req, res) {
//   try {
//     const lead = await LeadModel.create({
//       ...req.body,
//       createdBy: req.user._id,
//     });
//     const adminTokens = await DeviceToken.find({
//       "meta.userType": "admin",
//     });

//     for (const t of adminTokens) {
//       await sendToToken(t.token, {
//         notification: {
//           title: "📌 New Lead Created",
//           body: lead.personalInfo?.name || "New lead added",
//         },
//         data: {
//           type: "lead_created",
//           leadId: lead._id.toString(),
//         },
//         android: {
//           priority: "high",
//           notification: {
//             channelId: "default",
//             sound: "default",
//           },
//         },
//       });
//     }

//     res.status(201).json({ success: true, lead });
//   } catch (err) {
//     res.status(400).json({ success: false, message: err.message });
//   }
// }
export async function createLead(req, res) {
  try {
    const lead = await LeadModel.create({
      ...req.body,
      createdBy: req.user._id,
    });

    await notifyLeadUsers({
      lead,
      title: "New Lead Created",
      body: lead.personalInfo?.name || "New lead added",
      data: {
        type: "lead_created",
        leadId: lead._id.toString(),
        leadUserId: lead.assignedTo?._id?.toString() || "",
      },
      notifyAdmins: true,
      notifyAssigned: true,
    });

    return res.status(201).json({ success: true, lead });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// ➤ GET ALL LEADS
export async function getLeads(req, res) {
  try {
    let data = await LeadModel.find()
      .populate("branch")
      .populate("assignedTo", "name email")
      .populate("notes.addedBy", "name email")
      .lean();

    const leads = data.map(lead => ({
      ...lead,
      assignedTo: normalizeAssignedTo(lead.assignedTo)
    }));

    return res.json({ success: true, leads });
  } catch (err) {
    console.log("GET LEADS ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}



// ➤ GET LEAD BY ID
export async function getLeadById(req, res) {
  try {
    let lead = await LeadModel.findById(req.params.id)
      .populate("branch")
      .populate("assignedTo", "name email")
      .populate("notes.addedBy", "name email")
      .lean();

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found"
      });
    }

    // Normalize assignedTo field
    lead.assignedTo = normalizeAssignedTo(lead.assignedTo);

    return res.json({ success: true, lead });

  } catch (err) {
    console.log("GET LEAD BY ID ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}


export async function getLeadNotes(req, res) {
  try {
    const leadId = req.params.id;

    const lead = await LeadModel.findById(leadId)
      .select("notes personalInfo segment status priority addedBy")
      .populate("notes.addedBy", "name email");

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    return res.json({
      success: true,
      notes: lead.notes,
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// export const editNote = async (req, res) => {
//   try {
//     const { leadId, noteId } = req.params;
//     const { content, type, status } = req.body;

//     const lead = await LeadModel.findById(leadId);
//     if (!lead) {
//       return res.status(404).json({
//         success: false,
//         message: "Lead not found",
//       });
//     }

//     const note = lead.notes.find(
//       (n) => n._id.toString() === noteId
//     );

//     if (!note) {
//       return res.status(404).json({
//         success: false,
//         message: "Note not found",
//       });
//     }

//     // ✅ Update fields
//     if (content !== undefined) note.content = content;
//     if (type !== undefined) note.type = type;
//     if (status !== undefined) note.status = status;

//     note.updatedAt = new Date();
//     lead.lastModifiedBy = req.user._id;

//     await lead.save();

//     return res.json({
//       success: true,
//       message: "Note updated successfully",
//       note,
//     });
//   } catch (error) {
//     console.error("Edit note error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error while editing note",
//     });
//   }
// };
export const editNote = async (req, res) => {
  try {
    const { leadId, noteId } = req.params;
    const { content, type, status } = req.body;

    const lead = await LeadModel.findById(leadId).populate(
      "assignedTo",
      "name"
    );

    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    const note = lead.notes.find(
      (n) => n._id.toString() === noteId
    );

    if (!note) {
      return res.status(404).json({ success: false, message: "Note not found" });
    }

    // Update note
    if (content !== undefined) note.content = content;
    if (type !== undefined) note.type = type;
    if (status !== undefined) note.status = status;

    note.updatedAt = new Date();
    lead.lastModifiedBy = req.user._id;

    await lead.save();

    await notifyLeadUsers({
      lead,
      title: "Lead Note Updated",
      body: content
        ? content.slice(0, 80)
        : "A note was updated on this lead",
      data: {
        type: "lead_note_updated",
        leadId,
        noteId,
        content: content || "",
        status,
        adminOnly: "true", // ✅ REQUIRED
      },
      notifyAdmins: true,
      notifyAssigned: true,
    });


    return res.json({
      success: true,
      message: "Note updated successfully",
      note,
    });

  } catch (error) {
    console.error("Edit note error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while editing note",
    });
  }
};


export const deleteNote = async (req, res) => {
  try {
    const { leadId, noteId } = req.params;

    const lead = await LeadModel.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    const initialCount = lead.notes.length;

    lead.notes = lead.notes.filter(
      (n) => n._id.toString() !== noteId
    );

    if (lead.notes.length === initialCount) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    lead.lastModifiedBy = req.user._id;
    await lead.save();

    return res.json({
      success: true,
      message: "Note deleted successfully",
    });
  } catch (error) {
    console.error("Delete note error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while deleting note",
    });
  }
};


export async function updateLeadStatus(req, res) {
  try {
    const { status } = req.body;
    const { id } = req.params;

    const updatedLead = await LeadModel.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate("assignedTo", "name");
    if (updatedLead) {
      await notifyLeadUsers({
        lead: updatedLead,
        title: "Lead Status Updated",
        body: `Status changed to ${status}`,
        data: {
          type: "lead_status_updated",
          leadId: id,
          status: String(status),
        },
        notifyAdmins: true,
        notifyAssigned: true,
      });
    }


    return res.json({
      success: true,
      message: "Lead status updated",
      lead: updatedLead,
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}



// export async function updateLeadStatus(req, res) {
//   try {
//     const { status } = req.body;
//     const { id } = req.params;

//     const validStatuses = [
//       "unassigned",
//       "new",
//       "in_progress",
//       "interested",
//       "not_interested",
//       "follow_up",
//       "converted",
//       "dropped"
//     ];

//     if (!validStatuses.includes(status)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid status provided",
//       });
//     }

//     const updatedLead = await LeadModel.findByIdAndUpdate(
//       id,
//       { status },
//       { new: true }
//     );

//     return res.json({
//       success: true,
//       message: "Lead status updated",
//       lead: updatedLead,
//     });

//   } catch (err) {
//     return res.status(500).json({ success: false, message: err.message });
//   }
// }



// ➤ UPDATE LEAD
export async function updateLead(req, res) {
  try {
    const lead = await LeadModel.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastModifiedBy: req.user._id },
      { new: true }
    );

    res.json({ success: true, lead });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

// ➤ DELETE LEAD
export async function deleteLead(req, res) {
  try {
    await LeadModel.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Lead deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
// export async function addNote(req, res) {
//   try {
//     const { content, type } = req.body;
//     const leadId = req.params.id;

//     if (!content || !type) {
//       return res.status(400).json({
//         success: false,
//         message: "Content & Type are required",
//       });
//     }

//     const lead = await LeadModel.findById(leadId);
//     if (!lead) {
//       return res.status(404).json({ success: false, message: "Lead not found" });
//     }

//     lead.notes.push({
//       content,
//       type,
//       status: req.body.status || "in_progress",
//       addedBy: req.user._id,
//       addedAt: new Date(),
//       updatedAt: new Date(),
//     });

//     await lead.save();

//     const updatedLead = await LeadModel.findById(leadId)
//       .populate("notes.addedBy", "name email");

//     return res.json({
//       success: true,
//       message: "Note added successfully",
//       lead: updatedLead,
//     });

//   } catch (err) {
//     return res.status(500).json({ success: false, message: err.message });
//   }
// }

// export async function addNote(req, res) {
//   try {
//     const { content, type } = req.body;
//     const leadId = req.params.id;

//     const lead = await LeadModel.findById(leadId).populate("assignedTo", "name");

//     lead.notes.push({
//       content,
//       type,
//       status: req.body.status || "in_progress",
//       addedBy: req.user._id,
//       addedAt: new Date(),
//       updatedAt: new Date(),
//     });

//     await lead.save();

//     /* 🔔 FCM: NOTE ADDED */
//     if (lead.assignedTo?._id) {
//       const tokens = await DeviceToken.find({
//         "meta.userId": lead.assignedTo._id.toString(),
//       });

//       for (const t of tokens) {
//         await sendToToken(t.token, {
//           notification: {
//             title: "📝 Lead Note Added",
//             body: content.slice(0, 80),
//           },
//           data: {
//             type: "lead_note_added",
//             leadId,
//           },
//           android: {
//             priority: "high",
//             notification: {
//               channelId: "default",
//               sound: "default",
//             },
//           },
//         });
//       }
//     }

//     return res.json({
//       success: true,
//       message: "Note added successfully",
//       lead,
//     });

//   } catch (err) {
//     return res.status(500).json({ success: false, message: err.message });
//   }
// }

export async function addNote(req, res) {
  try {
    const { content, type } = req.body;
    const leadId = req.params.id;

    const lead = await LeadModel.findById(leadId).populate("assignedTo", "name");

    lead.notes.push({
      content,
      type,
      status: req.body.status || "in_progress",
      addedBy: req.user._id,
      addedAt: new Date(),
      updatedAt: new Date(),
    });

    await lead.save();

    const note = lead.notes[lead.notes.length - 1];

    await notifyLeadUsers({
      lead,
      title: "Lead Note Added",
      body: (content || "").slice(0, 80) || "A new note was added",
      data: {
        type: "lead_note_added",
        leadId: lead._id.toString(),
        noteId: note._id.toString(),
        content: content || "",
        adminOnly: "true", // ✅ REQUIRED
      },
      notifyAdmins: true,
      notifyAssigned: true,
    });



    return res.json({
      success: true,
      message: "Note added successfully",
      lead,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}


// ➤ UPDATE FOLLOW UP DATE
export async function updateFollowUp(req, res) {
  try {
    const lead = await LeadModel.findByIdAndUpdate(
      req.params.id,
      { followUpDate: req.body.followUpDate },
      { new: true }
    );

    res.json({ success: true, lead });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

// UNIVERSAL FILTER CONTROLLER
export async function filterLeads(req, res) {
  try {
    const query = {};

    if (req.query.status) query.status = req.query.status;
    if (req.query.source) query.leadSource = req.query.source;
    if (req.query.segment) query.segment = req.query.segment;
    if (req.query.branchId) query.branch = req.query.branchId;
    if (req.query.assignedTo) query.assignedTo = req.query.assignedTo;

    let data = await LeadModel.find(query)
      .populate("branch")
      .populate("assignedTo", "name")
      .populate("notes.addedBy", "name email")
      .lean();

    const leads = data.map(l => ({
      ...l,
      assignedTo: normalizeAssignedTo(l.assignedTo)
    }));

    res.json({ success: true, leads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}


// export async function bulkAssign(req, res) {
//   try {
//     console.log("🔥 /lead/bulk-assign HIT");
//     console.log("Request Body:", req.body);
//     console.log("Current User:", req.user);

//     const { leads, branchId, userId } = req.body;

//     if (!req.user) {
//       return res.status(401).json({ success: false, message: "Login required." });
//     }
//     const allowedTypes = ["admin"];
//     if (!allowedTypes.includes(req.user.user_type)) {
//       console.log("❌ Unauthorized User Type:", req.user.user_type);
//       return res.status(403).json({ success: false, message: "Only admin can bulk assign" });
//     }

//     if (!leads?.length) {
//       return res.status(400).json({ success: false, message: "No leads selected" });
//     }

//     if (!branchId || !userId) {
//       return res.status(400).json({ success: false, message: "Branch/User required" });
//     }

//     console.log("📌 Updating DB...");

//     await LeadModel.updateMany(
//       { _id: { $in: leads } },
//       {
//         $set: {
//           branch: branchId,
//           assignedTo: userId,
//           updatedAt: new Date(),
//           lastModifiedBy: req.user._id,
//         },
//       }
//     );

//     const updatedLeads = await LeadModel.find({ _id: { $in: leads } })
//       .populate("branch", "name")
//       .populate("assignedTo", "name email");
//     return res.json({
//       success: true,
//       message: "Bulk assign successful",
//       updatedCount: updatedLeads.length,
//       updatedLeads,
//     });

//   } catch (err) {
//     console.error("🔥 BULK ASSIGN ERROR:", err);
//     return res.status(500).json({ success: false, message: err.message });
//   }
// }


// export async function bulkAssign(req, res) {
//   try {
//     console.log("🔥 /lead/bulk-assign HIT");
//     console.log("Request Body:", req.body);
//     console.log("Current User:", req.user);

//     const { leads, branchId, userId } = req.body;

//     if (!req.user) {
//       return res.status(401).json({
//         success: false,
//         message: "Login required.",
//       });
//     }

//     const allowedTypes = ["admin"];
//     if (!allowedTypes.includes(req.user.user_type)) {
//       console.log("❌ Unauthorized User Type:", req.user.user_type);
//       return res.status(403).json({
//         success: false,
//         message: "Only admin can bulk assign",
//       });
//     }

//     if (!leads?.length) {
//       return res.status(400).json({
//         success: false,
//         message: "No leads selected",
//       });
//     }

//     if (!branchId || !userId) {
//       return res.status(400).json({
//         success: false,
//         message: "Branch/User required",
//       });
//     }

//     console.log("📌 Updating DB...");

//     await LeadModel.updateMany(
//       { _id: { $in: leads } },
//       {
//         $set: {
//           branch: branchId,
//           assignedTo: userId,
//           updatedAt: new Date(),
//           lastModifiedBy: req.user._id,
//         },
//       }
//     );

//     const updatedLeads = await LeadModel.find({ _id: { $in: leads } })
//       .populate("branch", "name")
//       .populate("assignedTo", "name email");

//     /* 🔔 FCM: LEAD ASSIGNED (APK SAFE) */
//     const tokens = await DeviceToken.find({
//       "meta.userId": userId,
//     });

//     for (const t of tokens) {
//       await sendToToken(t.token, {
//         notification: {
//           title: "📌 New Lead Assigned",
//           body: `${updatedLeads.length} lead(s) assigned to you`,
//         },
//         data: {
//           type: "lead_assigned",
//         },
//         android: {
//           priority: "high",
//           notification: {
//             channelId: "default",
//             sound: "default",
//           },
//         },
//       });
//     }

//     return res.json({
//       success: true,
//       message: "Bulk assign successful",
//       updatedCount: updatedLeads.length,
//       updatedLeads,
//     });

//   } catch (err) {
//     console.error("🔥 BULK ASSIGN ERROR:", err);
//     return res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// }

export async function bulkAssign(req, res) {
  try {
    console.log("/lead/bulk-assign HIT");
    console.log("Request Body:", req.body);
    console.log("Current User:", req.user);

    const { leads, branchId, userId } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Login required.",
      });
    }

    const allowedTypes = ["admin"];
    if (!allowedTypes.includes(req.user.user_type)) {
      console.log("Unauthorized User Type:", req.user.user_type);
      return res.status(403).json({
        success: false,
        message: "Only admin can bulk assign",
      });
    }

    if (!leads?.length) {
      return res.status(400).json({
        success: false,
        message: "No leads selected",
      });
    }

    if (!branchId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Branch/User required",
      });
    }

    console.log("Updating DB...");

    await LeadModel.updateMany(
      { _id: { $in: leads } },
      {
        $set: {
          branch: branchId,
          assignedTo: userId,
          updatedAt: new Date(),
          lastModifiedBy: req.user._id,
        },
      }
    );

    const updatedLeads = await LeadModel.find({ _id: { $in: leads } })
      .populate("branch", "name")
      .populate("assignedTo", "name email");

    const leadLike = {
      assignedTo: userId,
    };

    await notifyLeadUsers({
      lead: leadLike,
      title: "New Lead Assigned",
      body: `${updatedLeads.length} lead(s) assigned to you`,
      data: {
        type: "lead_assigned",
        assignedTo: userId,
        count: String(updatedLeads.length),
      },
      notifyAdmins: true,
      notifyAssigned: true,
    });


    return res.json({
      success: true,
      message: "Bulk assign successful",
      updatedCount: updatedLeads.length,
      updatedLeads,
    });

  } catch (err) {
    console.error("BULK ASSIGN ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}


export async function getLeadsByUser(req, res) {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID required" });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const query = { assignedTo: userId };

    const [leads, total] = await Promise.all([
      LeadModel.find(query)
        .populate("branch", "name")
        .populate("assignedTo", "name email")
        .populate("notes.addedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LeadModel.countDocuments(query),
    ]);

    return res.json({
      success: true,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      count: leads.length,
      leads,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

// FIXED & PROFESSIONAL EXPORT TEMPLATE
export async function exportLeadTemplate(req, res) {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Lead Template");

    sheet.columns = [
      { header: "name", key: "name", width: 20 },
      { header: "email", key: "email", width: 25 },
      { header: "phone", key: "phone", width: 15 },
      { header: "alternatePhone", key: "alternatePhone", width: 15 },
      { header: "city", key: "city", width: 15 },
      { header: "state", key: "state", width: 15 },
      { header: "country", key: "country", width: 15 },
      { header: "pincode", key: "pincode", width: 10 },

      { header: "leadSource", key: "leadSource", width: 15 },
      { header: "segment", key: "segment", width: 20 },

      { header: "investmentAmount", key: "investmentAmount", width: 15 },
      { header: "investmentCurrency", key: "investmentCurrency", width: 10 },
      { header: "investmentRemark", key: "investmentRemark", width: 25 },

      { header: "status", key: "status", width: 15 },
      { header: "priority", key: "priority", width: 10 },

      { header: "branchId (ObjectId)", key: "branch", width: 24 },
      { header: "assignedTo (ObjectId)", key: "assignedTo", width: 24 },

      { header: "tags (comma separated)", key: "tags", width: 25 },
      { header: "followUpDate (YYYY-MM-DD)", key: "followUpDate", width: 15 },
    ];

    // Auto-format header
    sheet.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=lead_import_template.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function exportLeads(req, res) {
  try {
    const { branchId, assignedTo } = req.query;

    let filter = {};

    // ✔ If branch selected
    if (branchId && branchId !== "null") {
      filter.branch = branchId;
    }

    // ✔ If user selected
    if (assignedTo && assignedTo !== "null") {
      filter.assignedTo = assignedTo;
    }

    // ✔ If neither selected → filter = {} → exports ALL
    const leads = await LeadModel.find(filter).populate("branch assignedTo");

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Leads");

    sheet.columns = [
      { header: "Name", key: "name", width: 20 },
      { header: "Email", key: "email", width: 25 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "City", key: "city", width: 15 },
      { header: "Lead Source", key: "leadSource", width: 15 },
      { header: "Segment", key: "segment", width: 15 },
      { header: "Status", key: "status", width: 15 },
      { header: "Priority", key: "priority", width: 12 },
      { header: "Branch", key: "branch", width: 20 },
      { header: "Assigned To", key: "assignedTo", width: 20 },
      { header: "Follow Up", key: "followUpDate", width: 15 },
    ];

    leads.forEach((l) => {
      sheet.addRow({
        name: l.personalInfo?.name || "",
        email: l.personalInfo?.email || "",
        phone: l.personalInfo?.phone || "",
        city: l.personalInfo?.city || "",
        leadSource: l.leadSource,
        segment: l.segment,
        status: l.status,
        priority: l.priority,
        branch: l.branch?.name || "",
        assignedTo: l.assignedTo?.name || "",
        followUpDate: l.followUpDate
          ? l.followUpDate.toISOString().slice(0, 10)
          : "",
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=leads.xlsx"
    );

    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(buffer);

  } catch (err) {
    console.log("EXPORT ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// const val = (v) => (v === undefined || v === null ? "" : String(v).trim());

// async function processImportedSheet(buffer, branchId, userId, createdBy, saveToDB = false) {
//   const workbook = new ExcelJS.Workbook();
//   await workbook.xlsx.load(buffer);
//   const sheet = workbook.worksheets[0];

//   if (!sheet) {
//     return { success: false, message: "Invalid Excel sheet" };
//   }

//   const headers = [];
//   sheet.getRow(1).eachCell((cell, col) => {
//     headers[col] = val(cell.value);
//   });

//   let imported = 0;
//   let duplicates = 0;
//   let failed = 0;
//   let errors = [];

//   for (let r = 2; r <= sheet.rowCount; r++) {
//     const row = sheet.getRow(r);
//     const rowData = {};

//     row.eachCell((cell, col) => {
//       rowData[headers[col]] = val(cell.value);
//     });

//     const phone = rowData.phone;
//     if (!phone) {
//       failed++;
//       errors.push({ row: r, error: "Phone number missing" });
//       continue;
//     }

//     try {
//       // check if duplicate exists
//       const existingLead = await LeadModel.findOne({
//         "personalInfo.phone": phone,
//       });

//       if (existingLead) {
//         duplicates++;
//         errors.push({ row: r, error: "Duplicate lead found", phone });
//         continue; // ❌ do NOT insert/update
//       }

//       const leadData = {
//         personalInfo: {
//           name: rowData.name,
//           email: rowData.email,
//           phone: rowData.phone,
//           alternatePhone: rowData.alternatePhone,
//           city: rowData.city,
//           state: rowData.state,
//           country: rowData.country,
//           pincode: rowData.pincode,
//         },

//         leadSource: rowData.leadSource || "google",
//         segment: rowData.segment || "stock_equity",

//         investmentSize: {
//           amount: Number(rowData.investmentAmount) || 0,
//           currency: rowData.investmentCurrency || "INR",
//           remark: rowData.investmentRemark || "",
//         },

//         status: rowData.status || "new",
//         priority: rowData.priority || "medium",

//         branch: branchId,
//         assignedTo: userId || null,

//         tags: rowData.tags
//           ? rowData.tags.split(",").map((t) => t.trim())
//           : [],

//         followUpDate: rowData.followUpDate ? new Date(rowData.followUpDate) : null,
//         createdBy,
//       };

//       // ⚠️ Only save when saveToDB = true
//       if (saveToDB) {
//         await LeadModel.create(leadData);
//       }

//       imported++;

//     } catch (err) {
//       failed++;
//       errors.push({ row: r, error: err.message });
//     }
//   }

//   return {
//     success: true,
//     imported,
//     duplicates,
//     failed,
//     errors,
//   };
// }


// export async function importLeads(req, res) {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: "Excel file required",
//       });
//     }

//     const DEFAULT_BRANCH = "676f326dff3ede0000000000";
//     const DEFAULT_ASSIGNED_TO = null;

//     const result = await processImportedSheet(
//       req.file.buffer,
//       DEFAULT_BRANCH,
//       DEFAULT_ASSIGNED_TO,
//       req.user._id,
//       true  // saveToDB
//     );

//     return res.json({
//       success: true,
//       imported: result.imported,
//       duplicates: result.duplicates,
//       failed: result.failed,
//       errors: result.errors,
//     });

//   } catch (err) {
//     console.log("IMPORT ERROR:", err);
//     return res.status(500).json({ success: false, message: err.message });
//   }
// }
// export async function importUserLeads(req, res) {
//   try {
//     const { branchId, userId } = req.params;

//     if (!branchId || !userId) {
//       return res.status(400).json({
//         success: false,
//         message: "Branch ID and User ID are required",
//       });
//     }

//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: "Excel file required",
//       });
//     }

//     const result = await processImportedSheet(
//       req.file.buffer,
//       branchId,
//       userId,
//       req.user._id,
//       true // save to DB
//     );

//     return res.json({
//       success: true,
//       imported: result.imported,
//       duplicates: result.duplicates,
//       failed: result.failed,
//       errors: result.errors,
//     });

//   } catch (err) {
//     console.log("IMPORT USER LEADS ERROR:", err);
//     return res.status(500).json({ success: false, message: err.message });
//   }
// }


// const val = (v) => (v === undefined || v === null ? "" : String(v).trim());

// const normalizePhone = (p = "") => p.replace(/\D/g, "").slice(-10);
// const normalizeEmail = (e = "") => e.trim().toLowerCase();
// const normalizeLeadSource = (value = "") => {
//   const v = String(value)
//     .trim()
//     .toLowerCase()
//     .replace(/\s+/g, "_"); 

//   const MAP = {
//     facebook: "fb",
//     fb: "fb",
//     instagram: "ig",
//     ig: "ig",
//     google: "google",
//     website: "website",
//     referral: "referral",
//     cold_call: "cold_call",
//     coldcall: "cold_call",
//     linkedin: "linkedin",
//     twitter: "twitter",
//   };

//   return MAP[v] || "other";
// };

// async function processImportedSheet(
//   buffer,
//   branchId,
//   userId,
//   createdBy,
//   saveToDB = false
// ) {
//   const workbook = new ExcelJS.Workbook();
//   await workbook.xlsx.load(buffer);

//   const sheet = workbook.worksheets[0];
//   if (!sheet) return { success: false, message: "Invalid Excel file" };

// const HEADER_MAP = {
//   name: "name",
//   phone: "phone",
//   email: "email",
//   city: "city",
//   state: "state",
//   segment: "segment",
//   leadsource: "leadSource",
//   lead_source: "leadSource",
//   "lead source": "leadSource",
//   leadsource_: "leadSource",
// };


//   const headers = [];
//   sheet.getRow(1).eachCell((cell, col) => {
//     headers[col] = HEADER_MAP[val(cell.value).toLowerCase()] || val(cell.value).toLowerCase();
//   });

//   let imported = 0;
//   let duplicates = 0;
//   let failed = 0;
//   const errors = [];
//   const insertedLeads = [];

//   for (let r = 2; r <= sheet.rowCount; r++) {
//     const row = sheet.getRow(r);
//     const rowData = {};

//     row.eachCell((cell, col) => {
//       rowData[headers[col]] = val(cell.value);
//     });

//     if (!rowData.phone || !rowData.name) {
//       failed++;
//       errors.push({ row: r, error: "Name or phone missing" });
//       continue;
//     }

//     const phone = normalizePhone(rowData.phone);
//     const email = normalizeEmail(rowData.email);

//     try {
//       const exists = await LeadModel.findOne({
//         $or: [
//           { "personalInfo.phone": phone },
//           email ? { "personalInfo.email": email } : null,
//         ].filter(Boolean),
//       });

//       if (exists) {
//         duplicates++;
//         errors.push({ row: r, phone, email, error: "Duplicate lead" });
//         continue;
//       }

//       // ✅ ENUM-SAFE DEFAULTS
//       const safeSegment = [
//         "bank_nifty_option",
//         "stock_future",
//         "stock_equity",
//         "commodity",
//         "forex",
//         "crypto",
//         "mutual_funds",
//         "other",
//       ].includes(rowData.segment)
//         ? rowData.segment
//         : "other";

//      const safeSource = normalizeLeadSource(rowData.leadSource);

//       const leadData = {
//         personalInfo: {
//           name: rowData.name,
//           phone,
//           email,
//           city: rowData.city || "",
//           state: rowData.state || "",
//           country: "India",
//         },
//         leadSource: safeSource,
//         segment: safeSegment,
//         status: "new",
//         priority: "medium",
//         branch: branchId,
//         assignedTo: userId || null,
//         createdBy,
//       };


//       if (saveToDB) {
//         const saved = await LeadModel.create(leadData);
//         insertedLeads.push(saved);
//       }

//       imported++;
//     } catch (err) {
//       failed++;
//       errors.push({ row: r, error: err.message });
//     }
//   }

//   return {
//     success: true,
//     imported,
//     duplicates,
//     failed,
//     errors,
//     insertedLeads,
//   };
// }



// export async function importLeads(req, res) {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: "Excel file required",
//       });
//     }

//     const DEFAULT_BRANCH = "676f326dff3ede0000000000";
//     const DEFAULT_ASSIGNED_TO = null;

//     const result = await processImportedSheet(
//       req.file.buffer,
//       DEFAULT_BRANCH,
//       DEFAULT_ASSIGNED_TO,
//       req.user._id,
//       true
//     );

//     return res.json({
//       success: true,
//       imported: result.imported,
//       duplicates: result.duplicates,
//       failed: result.failed,
//       errors: result.errors,
//       leads: result.insertedLeads,
//     });
//   } catch (err) {
//     return res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// }

const val = (v) => (v === undefined || v === null ? "" : String(v).trim());

const normalizePhone = (p = "") => p.replace(/\D/g, "").slice(-10);
const normalizeEmail = (e = "") => e.trim().toLowerCase();

const normalizeLeadSource = (value = "") => {
  const v = String(value).trim().toLowerCase().replace(/\s+/g, "_");

  const MAP = {
    facebook: "fb",
    fb: "fb",
    instagram: "ig",
    ig: "ig",
    google: "google",
    website: "website",
    referral: "referral",
    cold_call: "cold_call",
    coldcall: "cold_call",
    linkedin: "linkedin",
    twitter: "twitter",
  };

  return MAP[v] || "other";
};

const SAFE_SEGMENTS = [
  "bank_nifty_option",
  "stock_future",
  "stock_equity",
  "commodity",
  "forex",
  "crypto",
  "mutual_funds",
  "other",
];

async function processImportedSheet(
  buffer,
  branchId,
  userId,
  createdBy,
  saveToDB = false
) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) return { success: false, message: "Invalid Excel file" };

  const HEADER_MAP = {
    name: "name",
    phone: "phone",
    email: "email",
    city: "city",
    state: "state",
    country: "country",
    pincode: "pincode",
    segment: "segment",
    leadsource: "leadSource",
    lead_source: "leadSource",
    "lead source": "leadSource",

    investmentamount: "investmentAmount",
    investmentcurrency: "investmentCurrency",
    investmentremark: "investmentRemark",

    status: "status",
    priority: "priority",
    tags: "tags",
    followupdate: "followUpDate",
    alternatephone: "alternatePhone",
  };

  const headers = [];
  sheet.getRow(1).eachCell((cell, col) => {
    headers[col] =
      HEADER_MAP[val(cell.value).toLowerCase()] ||
      val(cell.value).toLowerCase();
  });

  let imported = 0;
  let duplicates = 0;
  let failed = 0;
  const errors = [];
  const insertedLeads = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const rowData = {};

    row.eachCell((cell, col) => {
      rowData[headers[col]] = val(cell.value);
    });

    if (!rowData.phone || !rowData.name) {
      failed++;
      errors.push({ row: r, error: "Name or phone missing" });
      continue;
    }

    const phone = normalizePhone(rowData.phone);
    const email = normalizeEmail(rowData.email);

    try {
      const exists = await LeadModel.findOne({
        $or: [
          { "personalInfo.phone": phone },
          email ? { "personalInfo.email": email } : null,
        ].filter(Boolean),
      });

      if (exists) {
        duplicates++;
        errors.push({ row: r, phone, email, error: "Duplicate lead" });
        continue;
      }

      const leadData = {
        personalInfo: {
          name: rowData.name,
          email,
          phone,
          alternatePhone: rowData.alternatePhone || "",
          city: rowData.city || "",
          state: rowData.state || "",
          country: rowData.country || "India",
          pincode: rowData.pincode || "",
        },

        leadSource: normalizeLeadSource(rowData.leadSource),

        segment: SAFE_SEGMENTS.includes(rowData.segment)
          ? rowData.segment
          : "other",

        investmentSize: {
          amount: Number(rowData.investmentAmount) || 0,
          currency: rowData.investmentCurrency || "INR",
          remark: rowData.investmentRemark || "",
        },

        status: rowData.status || "new",
        priority: rowData.priority || "medium",

        tags: rowData.tags
          ? rowData.tags.split(",").map((t) => t.trim())
          : [],

        followUpDate: rowData.followUpDate
          ? new Date(rowData.followUpDate)
          : null,

        branch: branchId || null,
        assignedTo: userId || null,
        createdBy,
      };

      if (saveToDB) {
        const saved = await LeadModel.create(leadData);
        insertedLeads.push(saved);
      }

      imported++;
    } catch (err) {
      failed++;
      errors.push({ row: r, error: err.message });
    }
  }

  return {
    success: true,
    imported,
    duplicates,
    failed,
    errors,
    insertedLeads,
  };
}
export async function importLeads(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Excel file required",
      });
    }

    const DEFAULT_BRANCH = null;        // admin import
    const DEFAULT_ASSIGNED_TO = null;

    const result = await processImportedSheet(
      req.file.buffer,
      DEFAULT_BRANCH,
      DEFAULT_ASSIGNED_TO,
      req.user._id,
      true
    );

    return res.json({
      success: true,
      imported: result.imported,
      duplicates: result.duplicates,
      failed: result.failed,
      errors: result.errors,
      leads: result.insertedLeads || [],   // ✅ IMPORTANT
    });

  } catch (err) {
    console.error("IMPORT ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}




export async function importUserLeads(req, res) {
  try {
    const { branchId, userId } = req.params;

    if (!branchId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Branch ID and User ID required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Excel file required",
      });
    }

    const result = await processImportedSheet(
      req.file.buffer,
      branchId,
      userId,
      req.user._id,
      true
    );

    return res.json({
      success: true,
      imported: result.imported,
      duplicates: result.duplicates,
      failed: result.failed,
      errors: result.errors,
    });

  } catch (err) {
    console.log("IMPORT USER LEADS ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}









