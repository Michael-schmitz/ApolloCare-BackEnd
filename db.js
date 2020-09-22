const sql = require('mssql');
const { DB_PASS } = require('./utils/constants');
const config = {
    user: 'admin1',
    password: DB_PASS,
    server: 'jemm.database.windows.net',
    database: 'JEMM', 
    encrypt: true
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('Connected to MSSQL')
    return pool
  })
  .catch(err => console.log('Database Connection Failed! Bad Config: ', err));

async function doQuery(res, query, params, callback) {
    try {
        const pool = await poolPromise;
        let request = pool.request();
        params.forEach(function(p) {
            request.input(p.name, p.sqltype, p.value);
        });
        let result = await request.query(query);
        callback(result);
    } catch (err) {
        console.log(err);
        if(res != null) res.status(500).send(err);
    }
}

module.exports = {
  sql, poolPromise, doQuery
}