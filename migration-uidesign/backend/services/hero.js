const heroRepository = require("../repositories/hero");

const getAll = async () => heroRepository.findAll();

module.exports = {
  getAll,
};
