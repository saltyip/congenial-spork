const errorhandler = (err, req, res, next) => {
    const status = err.status || 500;

    // Don't leak internal error details in production
    const message = (status === 500 && process.env.NODE_ENV === 'production')
        ? 'Internal server error'
        : err.message;

    if (status === 500) {
        console.error(err);
    }

    res.status(status).json({ msg: message });
};

export default errorhandler;