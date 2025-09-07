import { Router } from 'express';
import Task from '../models/Task.js';
const router = Router();
router.get('/', async (_req, res) => {
    const tasks = await Task.find().lean();
    const instances = [];
    for (const t of tasks) {
        (t.instances || []).forEach((i) => instances.push({ _id: i._id, taskId: t._id, title: t.title, dueDateTime: i.dueDateTime, status: i.status, assignedTo: t.assignedTo }));
        if (t.nextDue)
            instances.push({ _id: `next-${t._id}`, taskId: t._id, title: t.title, dueDateTime: t.nextDue, status: 'Pending', assignedTo: t.assignedTo });
    }
    instances.sort((a, b) => new Date(a.dueDateTime).getTime() - new Date(b.dueDateTime).getTime());
    res.json(instances);
});
export default router;
