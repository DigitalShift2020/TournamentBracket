const tournamentRouter = require('express').Router();
const queryController = require('../controllers/queryController');
const viewController = require('../controllers/viewController');

function sendError(err, req, res, next) {
  res.status(500).json({
    status: 'error',
    message: err.message
  })
}
tournamentRouter.route('/')
  .get(queryController.getAll, viewController.sendCompetitors, sendError);

module.exports = tournamentRouter;
