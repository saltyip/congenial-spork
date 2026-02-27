import express from 'express';
import pool from '../db.js';
const router = express.Router();

const shortner_logic = (id) =>{
    //const back_part_ind = org_link.lastIndexOf('/');
    //const back_part = org_link.slice(back_part_ind);
    //const front_part = org_link.slice(0,back_part_ind) + '/' ;


    const char = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let string ="";
    while(id > 0){  
        string = char[id%62] + string;
        id = Math.floor(id/62);
    }
    return string || "0";

};


// @desc TO CREATE LINK OR GET LINK 
// @route POST
router.post('/',async(req,res,next) =>{
    try{
        if(!req.body || !req.body.org){
            const err = new Error("title or req body not properly sent");
            err.status = 400; //400 is for bad request
            return next(err);
        }
        const exist_query = 'SELECT original_url FROM urls WHERE original_url = $1;';
        const exist_result = await pool.query(exist_query,[req.body.org]);
        if(exist_result.rows.length){
            return res.status(200).json({msg: "already exists"});
        }
        const id_query = 'INSERT INTO urls (original_url) VALUES ($1) RETURNING id;';
        const result_logic = await pool.query(id_query,[req.body.org]); 
        const id = result_logic.rows[0].id;
        const newShort = shortner_logic(result_logic.rows[0].id);


        const insert_query = 'UPDATE urls SET short_code = $1 WHERE id = $2 RETURNING *;';
        const result_post = await pool.query(insert_query,[newShort,id]);
        res.status(201).json({msg: result_post.rows[0]});
        }
    catch(err){
        if(err.code === '23505'){
            return res.status(409).json({msg:"already existss"});
        }
        next(err);
    }
}
);

//@desc TO SHOW THE LINK
//@route GET 
router.get('/',async(req,res,next)=>{
    //res.status(200).json(links);
    try{
    const result_get = await pool.query('SELECT * FROM urls;');
    res.status(200).json(result_get.rows);
    }
    catch(err){
        next(err);
    }
});

//@desc REDIRECTS TO REAL LINK
//@route GET
router.get('/:code',async (req,res,next)=>{
    try{
    const code_query = 'SELECT original_url FROM urls WHERE short_code = $1';
    const result_code = await pool.query(code_query,[req.params.code]);
    if(!result_code.rows.length){
        const err = new Error("the following shor code couldnt be found")
        err.status = 404;
        return next(err);
    }
    const click_query = 'UPDATE urls SET clicks = clicks + 1 WHERE short_code = $1 '
    await pool.query(click_query,[req.params.code]);
    console.log(`redirected to ${result_code.rows[0].original_url} end`);
    res.redirect(result_code.rows[0].original_url); //redirects send 302 status by default
    }
    catch(err){
        next(err);
    }
});

//@desc to get clicks values 
//@route GET
router.get('/stats/:code', async(req,res,next) =>{

try {
    const clickonly_query = 'SELECT clicks FROM urls WHERE short_code = $1';
    const result_clickonly = await pool.query(clickonly_query,[req.params.code]);

    if(result_clickonly.rows.length == 0){
        const err = new Error("the following code doesnt exist");
        err.status = 404;
        return next(err);
    }
    res.status(200).json({msg : result_clickonly.rows[0].clicks});

} catch (err) {
    next(err);
}

});

export default router;
