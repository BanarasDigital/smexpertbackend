import multer from "multer";

const storage = multer.memoryStorage();

const excelUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.(xlsx|xls)$/)) {
      return cb(new Error("Only Excel files allowed (.xlsx/.xls)"), false);
    }
    cb(null, true);
  },
});

export default excelUpload;
