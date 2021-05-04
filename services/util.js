const bcrypt = require('bcryptjs');

const generateHashPassword = (password) => {
    try {
        return bcrypt.hash(password, 10);
    } catch (ex) {
        throw ex;
    }
}

module.exports = {
    generateHashPassword
}