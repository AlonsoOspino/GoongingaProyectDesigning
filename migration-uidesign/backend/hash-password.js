const bcrypt = require('bcrypt');

const password = 'JaredManager456$%&';
bcrypt.hash(password, 10).then(console.log).catch(console.error);