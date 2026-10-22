import path from 'path';
import express from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import db from '../db.js';
import auth from '../models/authMiddleware.js';
import isAdmin from '../middleware/isAdmin.js';
import fs from 'fs';
import { fileTypeFromFile } from 'file-type';
import { photoValidation } from '../middleware/validatePhoto.js';
import { validateResult } from '../middleware/validateResult.js';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Upload config (SECURE)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const extensions = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp'
    };

    const extension = extensions[file.mimetype];

    cb(null, `${randomUUID()}${extension}`);
  }
});

// Multer config
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only image files allowed'));
    }
    cb(null, true);
  }
});

// Middleware to verify image type
const verifyImageType = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      message: 'ต้องอัปโหลดรูปภาพ'
    });
  }

  try {
    const fileType = await fileTypeFromFile(req.file.path);

    const allowedTypes = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp'
    };

    if (
      !fileType ||
      !allowedTypes[fileType.mime]
    ) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) {
          console.error('Delete invalid file error:', unlinkErr);
        }
      });

      return res.status(400).json({
        message: 'ไฟล์รูปภาพไม่ถูกต้อง'
      });
    }

    next();
  } catch (err) {
    console.error('File type detection error:', err);

    fs.unlink(req.file.path, (unlinkErr) => {
      if (unlinkErr) {
        console.error('Delete invalid file error:', unlinkErr);
      }
    });

    return res.status(400).json({
      message: 'ไม่สามารถตรวจสอบไฟล์รูปภาพได้'
    });
  }
};

// POST
router.post(
  '/',
  auth,
  upload.single('image'),
  verifyImageType,
  photoValidation,
  validateResult,
  (req, res) => {


    if (!req.file) {
      return res.status(400).json({ message: 'ต้องอัปโหลดรูปภาพ' });
    }

    const {
      title,
      description,
      province,
      region,
      date,
      activity,
      latitude,
      longitude
    } = req.body;

    const imageUrl = `/uploads/${req.file.filename}`;
    const userId = req.user.id;

    db.run(
      `INSERT INTO photos
      (title, description, province, region, date, activity, latitude, longitude, image_url, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description, province, region, date, activity, latitude, longitude, imageUrl, userId],
      function (err) {
        if (err) {
          console.error(err);

          // Remove uploaded file if database insert fails
          fs.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr) {
              console.error('Delete orphan file error:', unlinkErr);
            }
          });

          return res.status(500).json({
            message: 'Internal Server Error'
          });
        }

        res.json({ id: this.lastID });
      }
    );
  }
);

// GET (เพิ่ม limit)
router.get('/', (req, res) => {
  db.all("SELECT * FROM photos LIMIT 50", [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
    res.json(rows);
  });
});

/* ADMIN: GET ALL PHOTOS */
router.get('/admin/all', auth, isAdmin, (req, res) => {
  db.all(
    `SELECT photos.*, users.username AS created_by_username
     FROM photos
     LEFT JOIN users ON photos.created_by = users.id
     ORDER BY photos.created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({
          message: 'Internal Server Error'
        });
      }

      res.json(rows);
    }
  );
});

/* USER: GET MY PHOTOS */
router.get('/my', auth, (req, res) => {
  db.all(
    `SELECT *
     FROM photos
     WHERE created_by = ?
     ORDER BY created_at DESC`,
    [req.user.id],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({
          message: 'Internal Server Error'
        });
      }

      res.json(rows);
    }
  );
});

// DELETE (Owner + Admin)
router.delete('/:id', auth, (req, res) => {
  const { id } = req.params;

  db.get("SELECT * FROM photos WHERE id = ?", [id], (err, photo) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }

    if (!photo) return res.status(404).json({ message: 'Photo not found' });

    const isOwner = photo.created_by === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // safe path
    const imagePath = path.join(
      __dirname,
      '../../uploads',
      path.basename(photo.image_url)
    );

    // Delete the file first, then delete the database record
    fs.unlink(imagePath, (unlinkErr) => {
      if (unlinkErr) {
        console.error("Delete file error:", unlinkErr);

        return res.status(500).json({
          message: 'ไม่สามารถลบไฟล์รูปภาพได้'
        });
      }

      db.run("DELETE FROM photos WHERE id = ?", [id], function (dbErr) {
        if (dbErr) {
          console.error(dbErr);
          return res.status(500).json({
            message: 'Internal Server Error'
          });
        }

        res.json({
          message: 'Deleted successfully'
        });
      });
    });
  });
});

export default router;