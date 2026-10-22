import { body } from 'express-validator';

export const photoValidation = [
  body('title')
    .escape()
    .trim()
    .notEmpty().withMessage('ต้องมีชื่อภาพ')
    .isLength({ min: 3 }).withMessage('ชื่อภาพต้องมากกว่า 3 ตัว'),

  body('description')
    .escape()
    .trim()
    .optional()
    .isLength({ max: 500 }).withMessage('รายละเอียดต้องไม่เกิน 500 ตัว'),

  body('province')
    .escape()
    .trim()
    .notEmpty().withMessage('ต้องมีจังหวัด'),

  body('region')
    .escape()
    .trim()
    .notEmpty().withMessage('ต้องมีภูมิภาค'),

  body('date')
    .escape()
    .trim()
    .notEmpty().withMessage('ต้องมีวันที่')
    .isISO8601().withMessage('รูปแบบวันที่ไม่ถูกต้อง'),

  body('activity')
    .escape()
    .trim()
    .notEmpty().withMessage('ต้องมีกิจกรรม'),

  body('latitude')
    .escape()
    .trim()
    .notEmpty().withMessage('ต้องมี latitude')
    .isFloat({ min: -90, max: 90 }).withMessage('latitude ไม่ถูกต้อง'),

  body('longitude')
    .escape()
    .trim()
    .notEmpty().withMessage('ต้องมี longitude')
    .isFloat({ min: -180, max: 180 }).withMessage('longitude ไม่ถูกต้อง'),
];