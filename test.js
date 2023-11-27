const { Client} = require('pg')

const db = new Client({
    host: 'localhost',
    database: 'tournament',
    user: 'postgres',
    password: 'himanshu@28',
    port: '5432'
})

db.connect().then(() => console.log('connected to db')).catch(() => console.log('errror'))

db.query('Select * from tournaments', (err,res)=>{
    if(err) console.log(err)
    else console.log(res)
    console.log('done')
})