export default function isAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'ต้องเป็น admin' });
  }
  next();
}