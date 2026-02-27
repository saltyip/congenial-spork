import {Pool} from 'pg';

const pool = new Pool({
    user:"postgres",
    host:"localhost",
    database:"urlshortner",
    port:5432
});

export default pool;