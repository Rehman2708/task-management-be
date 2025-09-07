import { Router } from 'express';
import Task from '../models/Task.js';
const router = Router();
router.get('/', async (_req, res) => {
    const tasks = await Task.find().lean();
    const history = [];
    for (const t of tasks) {
        (t.instances || []).forEach((inst) => history.push({ taskId: t._id, title: t.title, dueDateTime: inst.dueDateTime, status: inst.status, comments: inst.comments }));
    }
    history.sort((a, b) => new Date(b.dueDateTime).getTime() - new Date(a.dueDateTime).getTime());
    res.json(history.slice(0, 500));
});
export default router;
