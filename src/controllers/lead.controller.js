import LeadModel from "../model/lead.model.js";
import ExcelJS from "exceljs";
// ➤ CREATE LEAD
export async function createLead(req, res) {
  try {
    const lead = await LeadModel.create({
      ...req.body,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, lead });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

// ➤ GET ALL LEADS
export async function getLeads(req, res) {
  try {
    const leads = await LeadModel.find()
      .populate("branch")
      .populate("assignedTo")
      .populate("notes.addedBy", "name email")

    res.json({ success: true, leads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ➤ GET LEAD BY ID
export async function getLeadById(req, res) {
  try {
    const lead = await LeadModel.findById(req.params.id)
      .populate("branch")
      .populate("assignedTo", "name")
      .populate("notes.addedBy", "name");

    if (!lead)
      return res.status(404).json({ success: false, message: "Lead not found" });

    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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

export async function deleteNote(req, res) {
  try {
    const { leadId, noteId } = req.params;

    const lead = await LeadModel.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    lead.notes = lead.notes.filter((n) => n._id.toString() !== noteId);
    await lead.save();

    const updatedLead = await LeadModel.findById(leadId)
      .populate("notes.addedBy", "name email");

    return res.json({
      success: true,
      message: "Note deleted successfully",
      lead: updatedLead,
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}


export async function editNote(req, res) {
  try {
    const { leadId, noteId } = req.params;
    const { content, type } = req.body;

    const lead = await LeadModel.findById(leadId);
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    const note = lead.notes.id(noteId);
    if (!note) return res.status(404).json({ success: false, message: "Note not found" });

    note.content = content || note.content;
    note.type = type || note.type;
    note.updatedAt = new Date();

    await lead.save();

    const updatedLead = await LeadModel.findById(leadId)
      .populate("notes.addedBy", "name email");

    return res.json({
      success: true,
      message: "Note updated successfully",
      lead: updatedLead,
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateLeadStatus(req, res) {
  try {
    const { status } = req.body;
    const { id } = req.params;

    const validStatuses = [
      "unassigned",
      "new",
      "in_progress",
      "interested",
      "not_interested",
      "follow_up",
      "converted",
      "dropped"
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status provided",
      });
    }

    const updatedLead = await LeadModel.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    return res.json({
      success: true,
      message: "Lead status updated",
      lead: updatedLead,
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}



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
export async function addNote(req, res) {
  try {
    const { content, type } = req.body;
    const leadId = req.params.id;

    if (!content || !type) {
      return res.status(400).json({
        success: false,
        message: "Content & Type are required",
      });
    }

    const lead = await LeadModel.findById(leadId);
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    lead.notes.push({
      content,
      type,
      addedBy: req.user._id,
      addedAt: new Date(),
    });

    await lead.save();

    const updatedLead = await LeadModel.findById(leadId)
      .populate("notes.addedBy", "name email");

    return res.json({
      success: true,
      message: "Note added successfully",
      lead: updatedLead,
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

    const leads = await LeadModel.find(query)
      .populate("branch")
      .populate("assignedTo", "name")
      .populate("notes.addedBy", "name email")

    res.json({ success: true, leads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function bulkAssign(req, res) {
  try {
    console.log("🔥 /lead/bulk-assign HIT");
    console.log("Request Body:", req.body);
    console.log("Current User:", req.user);

    const { leads, branchId, userId } = req.body;

    if (!req.user) {
      return res.status(401).json({ success: false, message: "Login required." });
    }
    const allowedTypes = ["admin"]; 
    if (!allowedTypes.includes(req.user.user_type)) {
      console.log("❌ Unauthorized User Type:", req.user.user_type);
      return res.status(403).json({ success: false, message: "Only admin can bulk assign" });
    }

    if (!leads?.length) {
      return res.status(400).json({ success: false, message: "No leads selected" });
    }

    if (!branchId || !userId) {
      return res.status(400).json({ success: false, message: "Branch/User required" });
    }

    console.log("📌 Updating DB...");

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

    console.log("✅ Updated Leads:", updatedLeads);

    return res.json({
      success: true,
      message: "Bulk assign successful",
      updatedCount: updatedLeads.length,
      updatedLeads,
    });

  } catch (err) {
    console.error("🔥 BULK ASSIGN ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
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

    const query = {};

    if (branchId && branchId !== "all") {
      query.branch = branchId;
    }

    if (assignedTo && assignedTo !== "all") {
      query.assignedTo = assignedTo;
    }

    const leads = await LeadModel.find(query)
      .populate("assignedTo")
      .populate("branch")
      .lean();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Filtered Leads");

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

      { header: "branchId", key: "branch", width: 24 },
      { header: "assignedToId", key: "assignedTo", width: 24 },

      { header: "tags", key: "tags", width: 25 },
      { header: "followUpDate", key: "followUpDate", width: 20 },
    ];

    leads.forEach((lead) => {
      sheet.addRow({
        name: lead.personalInfo?.name,
        email: lead.personalInfo?.email,
        phone: lead.personalInfo?.phone,
        alternatePhone: lead.personalInfo?.alternatePhone,
        city: lead.personalInfo?.city,
        state: lead.personalInfo?.state,
        country: lead.personalInfo?.country,
        pincode: lead.personalInfo?.pincode,

        leadSource: lead.leadSource,
        segment: lead.segment,

        investmentAmount: lead.investmentSize?.amount,
        investmentCurrency: lead.investmentSize?.currency,
        investmentRemark: lead.investmentSize?.remark,

        status: lead.status,
        priority: lead.priority,

        branch: lead.branch?._id?.toString(),
        assignedTo: lead.assignedTo?._id?.toString(),

        tags: lead.tags?.join(","),
        followUpDate: lead.followUpDate
          ? lead.followUpDate.toISOString().slice(0, 10)
          : "",
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=filtered-leads.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
const val = (v) => (v === undefined || v === null ? "" : String(v).trim());

async function processImportedSheet(buffer, branchId, userId, createdBy, saveToDB = false) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];

  if (!sheet) {
    return { success: false, message: "Invalid Excel sheet" };
  }

  const headers = [];
  sheet.getRow(1).eachCell((cell, col) => {
    headers[col] = val(cell.value);
  });

  let imported = 0;
  let duplicates = 0;
  let failed = 0;
  let errors = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const rowData = {};

    row.eachCell((cell, col) => {
      rowData[headers[col]] = val(cell.value);
    });

    const phone = rowData.phone;
    if (!phone) {
      failed++;
      errors.push({ row: r, error: "Phone number missing" });
      continue;
    }

    try {
      // check if duplicate exists
      const existingLead = await LeadModel.findOne({
        "personalInfo.phone": phone,
      });

      if (existingLead) {
        duplicates++;
        errors.push({ row: r, error: "Duplicate lead found", phone });
        continue; // ❌ do NOT insert/update
      }

      const leadData = {
        personalInfo: {
          name: rowData.name,
          email: rowData.email,
          phone: rowData.phone,
          alternatePhone: rowData.alternatePhone,
          city: rowData.city,
          state: rowData.state,
          country: rowData.country,
          pincode: rowData.pincode,
        },

        leadSource: rowData.leadSource || "google",
        segment: rowData.segment || "stock_equity",

        investmentSize: {
          amount: Number(rowData.investmentAmount) || 0,
          currency: rowData.investmentCurrency || "INR",
          remark: rowData.investmentRemark || "",
        },

        status: rowData.status || "new",
        priority: rowData.priority || "medium",

        branch: branchId,
        assignedTo: userId || null,

        tags: rowData.tags
          ? rowData.tags.split(",").map((t) => t.trim())
          : [],

        followUpDate: rowData.followUpDate ? new Date(rowData.followUpDate) : null,
        createdBy,
      };

      // ⚠️ Only save when saveToDB = true
      if (saveToDB) {
        await LeadModel.create(leadData);
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

    const DEFAULT_BRANCH = "676f326dff3ede0000000000";
    const DEFAULT_ASSIGNED_TO = null;

    const result = await processImportedSheet(
      req.file.buffer,
      DEFAULT_BRANCH,
      DEFAULT_ASSIGNED_TO,
      req.user._id,
      true  // saveToDB
    );

    return res.json({
      success: true,
      imported: result.imported,
      duplicates: result.duplicates,
      failed: result.failed,
      errors: result.errors,
    });

  } catch (err) {
    console.log("IMPORT ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
export async function importUserLeads(req, res) {
  try {
    const { branchId, userId } = req.params;

    if (!branchId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Branch ID and User ID are required",
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
      true // save to DB
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











