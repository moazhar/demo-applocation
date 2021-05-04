const jwt = require('jsonwebtoken');
const Users = require('../models/user');

const authenticate = async (req, res, next) => {
    try {
        const token = req.cookies.jwt_token;
        if (!token) {
            return res.status(401).send({
                errorCode: 401,
                errorMessage: 'Unauthorized'
            });
        }
        const verifyUser = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await Users.findOne({ _id: verifyUser._id });
        console.log(`User ${user.username} is authenticated Successfully`);

        req.token = token;
        req.user = user;

        next();
    } catch (ex) {
        return res.status(401).send({
            errorCode: 401,
            errorMessage: 'Unauthorized'
        });
    }
}

const validatePassword = async (req, res, next) => {
    const password = req.body.password;
    const regex = /^(?=.*[\d])(?=.*[A-Z])(?=.*[a-z])(?=.*[!@#$%^&*])[\w!@#$%^&*]{8,}$/;

    /* Passwords must be 
       At least 8 characters long, max length anything
       Include at least 1 lowercase letter
       1 capital letter
       1 number
       1 special character => !@#$%^&* */

    if (password) {
        if (regex.test(password)) {
            next();
        } else {
            return res.status(400).send({
                errorCode: 400,
                errorMessage: `The password you entered doesn't meet the password policy`
            });
        }
    } else {
        return res.status(400).send({
            errorCode: 400,
            errorMessage: `Missing Password`
        });
    }

}

module.exports = {
    authenticate,
    validatePassword
}