const { Client, Pool } = require('pg');
const config = require('./dbConfig')

const db = new Client(config)
const pool = new Pool(config);
db.connect().then(() => console.log('connected to db')).catch(() => console.log('errror'))
// write a db query to extract time from server
db.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.log(err.stack)
    } else {
        console.log(res.rows)
    }
})
module.exports = {db, pool};