const mapRepository = require("../repositories/map");

const getAll = async () => mapRepository.findAll();

module.exports = {
  getAll,
};
