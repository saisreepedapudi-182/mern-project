const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');

router.post('/', rideController.createRide);
router.get('/', rideController.getRides);
router.get('/all', rideController.getAllRides);
router.post('/assign', rideController.assignDriver);
router.put('/cancel/:rideId', rideController.cancelRide);
router.put('/fare', rideController.updateRideFare);
router.put('/status', rideController.updateRideStatus);
router.post('/feedback', rideController.leaveFeedback);
router.get('/feedback', rideController.getFeedback);

module.exports = router;
