const CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

const toBase62 = (id) => {
    let str = '';
    while (id > 0) {
        str = CHARS[id % 62] + str;
        id = Math.floor(id / 62);
    }
    return str || '0';
};

export default toBase62;
