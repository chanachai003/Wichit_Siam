import express from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { storageBucket, supabase } from '../supabase.js';
import auth from '../models/authMiddleware.js';
import isAdmin from '../middleware/isAdmin.js';
import { fileTypeFromBuffer } from 'file-type';
import { photoValidation } from '../middleware/validatePhoto.js';
import { validateResult } from '../middleware/validateResult.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only image files allowed'));
    }
    cb(null, true);
  }
});

const verifyImageType = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      message: 'ต้องอัปโหลดรูปภาพ'
    });
  }

  try {
    const fileType = await fileTypeFromBuffer(req.file.buffer);

    const allowedMimeTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/webp'
    ]);

    if (
      !fileType ||
      !allowedMimeTypes.has(fileType.mime) ||
      fileType.mime !== req.file.mimetype
    ) {
      return res.status(400).json({
        message: 'ไฟล์รูปภาพไม่ถูกต้อง'
      });
    }

    next();
  } catch (err) {
    console.error('File type detection error:', err);

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
  async (req, res) => {
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

    const fileExtensions = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp'
    };
    const objectPath =
      `photos/${randomUUID()}.${fileExtensions[req.file.mimetype]}`;
    let imageUploaded = false;

    try {
      const { error: uploadError } = await supabase.storage
        .from(storageBucket)
        .upload(objectPath, req.file.buffer, {
          contentType: req.file.mimetype,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }
      imageUploaded = true;

      const imageUrl = supabase.storage
        .from(storageBucket)
        .getPublicUrl(objectPath)
        .data.publicUrl;

      const result = await db.query(
        `INSERT INTO photos
         (title, description, province, region, date, activity, latitude, longitude, image_url, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          title,
          description || '',
          province,
          region,
          date,
          activity,
          latitude,
          longitude,
          imageUrl,
          req.user.id
        ]
      );

      res.json({ id: result.rows[0].id });
    } catch (err) {
      console.error('Save photo failed:', err);

      if (imageUploaded) {
        try {
          const { error: cleanupError } = await supabase.storage
            .from(storageBucket)
            .remove([objectPath]);
          if (cleanupError) {
            console.error('Delete orphan Supabase image error:', cleanupError);
          }
        } catch (cleanupError) {
          console.error('Delete orphan Supabase image error:', cleanupError);
        }
      }

      res.status(500).json({ message: 'Internal Server Error' });
    }
  }
);

// GET (เพิ่ม limit)
router.get('/', async (req, res) => {
  const result = await db.query('SELECT * FROM photos LIMIT 50');
  res.json(result.rows);
});

/* ADMIN: GET ALL PHOTOS */
router.get('/admin/all', auth, isAdmin, async (req, res) => {
  const result = await db.query(
    `SELECT photos.*, users.username AS created_by_username
     FROM photos
     LEFT JOIN users ON photos.created_by = users.id
     ORDER BY photos.created_at DESC`
  );
  res.json(result.rows);
});

/* USER: GET MY PHOTOS */
router.get('/my', auth, async (req, res) => {
  const result = await db.query(
    `SELECT *
     FROM photos
     WHERE created_by = $1
     ORDER BY created_at DESC`,
    [req.user.id]
  );
  res.json(result.rows);
});

// DELETE (Owner + Admin)
router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;

  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(404).json({ message: 'Photo not found' });
  }

  const result = await db.query('SELECT * FROM photos WHERE id = $1', [id]);
  const photo = result.rows[0];

  if (!photo) return res.status(404).json({ message: 'Photo not found' });

  const isOwner = photo.created_by === req.user.id;
  const hasAdminRole = req.user.role === 'admin';

  if (!isOwner && !hasAdminRole) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    const publicUrlPrefix = supabase.storage
      .from(storageBucket)
      .getPublicUrl('')
      .data.publicUrl;

    if (!photo.image_url.startsWith(publicUrlPrefix)) {
      throw new Error('Image URL does not belong to the configured storage bucket');
    }

    const objectPath = photo.image_url.slice(publicUrlPrefix.length);
    const { error } = await supabase.storage
      .from(storageBucket)
      .remove([objectPath]);

    if (error) {
      throw error;
    }

    await db.query('DELETE FROM photos WHERE id = $1', [id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('Delete photo asset failed:', err);
    res.status(500).json({
      message: 'ไม่สามารถลบไฟล์รูปภาพได้'
    });
  }
});

export default router;