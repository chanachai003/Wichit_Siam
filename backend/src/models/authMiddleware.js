import jwt from 'jsonwebtoken';
import db from '../db.js';

// ตรวจสอบ JWT และโหลดข้อมูล user ปัจจุบันจาก DB
export default function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'ไม่มี token' });
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ message: 'Authorization header ไม่ถูกต้อง' });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    db.get(
      'SELECT id, username, role FROM users WHERE id = ?',
      [decoded.id],
      (err, user) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: 'Internal Server Error' });
        }

        if (!user) {
          return res.status(401).json({ message: 'User ไม่พบ' });
        }

        // ใช้ข้อมูล user ปัจจุบันจาก DB
        req.user = user;

        next();
      }
    );
  } catch (err) {
    return res.status(403).json({ message: 'token ไม่ถูกต้อง' });
  }
}