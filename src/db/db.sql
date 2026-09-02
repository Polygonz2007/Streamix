
CREATE TABLE user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username varchar(63) NOT NULL UNIQUE,
    password varchar(255) NOT NULL
);

CREATE TABLE creator (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name varchar(255) NOT NULL,
    type_id TINYINT NOT NULL REFERENCES creator_type(id),
    user_id INTEGER REFERENCES user(id),

    generated TINYINT NOT NULL
);

CREATE TABLE creator_type (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name varchar(255) NOT NULL UNIQUE
);

CREATE TABLE collection (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name varchar(255),
    type_id TINYINT NOT NULL REFERENCES collection_type(id),
    creator_id INTEGER NOT NULL REFERENCES creator(id),

    image BLOB,
    generated TINYINT NOT NULL
);

CREATE TABLE collection_type (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name varchar(255) NOT NULL UNIQUE
);

CREATE TABLE track (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name varchar(255),
    path varchar(255),
    
    duration REAL NOT NULL,
    number INTEGER,
    disc INTEGER,
    released DATE
);

CREATE TABLE item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL REFERENCES track(id),
    collection_id INTEGER NOT NULL REFERENCES collection(id),
    position INTEGER NOT NULL,
    added TIMESTAMP DEFAULT (unixepoch('now')),

    UNIQUE(track_id, collection_id)
);

CREATE TABLE track_creator (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL REFERENCES track(id),
    creator_id INTEGER NOT NULL REFERENCES creator(id)
);

CREATE TABLE genre (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name varchar(255) NOT NULL UNIQUE
);

CREATE TABLE track_genre (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL REFERENCES track(id),
    genre_id INTEGER NOT NULL REFERENCES genre(id)
);

CREATE TABLE format (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name varchar(255),
    level INTEGER NOT NULL,

    encoder varchar(63),
    lossless TINYINT NOT NULL,
    bitrate INTEGER,
    vbr TINYINT NOT NULL,
    samplerate INTEGER,
    bitdepth INTEGER,
    frame_size INTEGER
);

CREATE TABLE track_format (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL REFERENCES track(id),
    format_id INTEGER NOT NULL REFERENCES format(id),
    ready TINYINT NOT NULL
);

CREATE TABLE track_frame (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL REFERENCES track(id),
    format_id INTEGER NOT NULL REFERENCES format(id),

    frame_index INTEGER NOT NULL,
    frame_size INTEGER NOT NULL,
    frame_data BLOB NOT NULL
);

CREATE INDEX track_frame_i1 ON track_frame(track_id);
CREATE INDEX track_frame_i2 ON track_frame(frame_index);

CREATE VIRTUAL TABLE search_index USING fts5 (
    item,
    collection,
    creator,
    genre,

    item_id UNINDEXED,
    collection_id UNINDEXED,
    creator_id UNINDEXED,
    genre_id UNINDEXED,
    prefix='2 3 4 5'
);



INSERT INTO creator_type(name) VALUES ("user"), ("artist");
INSERT INTO collection_type(name) VALUES ("single"), ("ep"), ("album"), ("playlist");

INSERT INTO format(name, level, lossless, vbr, bitrate, samplerate, bitdepth, frame_size, encoder) VALUES
("FLAC Max",     3, 1, 0, null, 96000, 24,   4096, "flac"),
("FLAC HD",      2, 1, 0, null, 48000, 24,   4096, "flac"),
("FLAC CD",      1, 1, 0, null, 44100, 16,   4096, "flac"),
("Opus Max",     0, 0, 1, 384,  48000, null, 960,  "libopus"),
("Opus High",   -1, 0, 1, 192,  48000, null, 960,  "libopus"),
("Opus Medium", -2, 0, 1, 96,   48000, null, 960,  "libopus"),
("Opus Low",    -3, 0, 1, 48,   48000, null, 960,  "libopus");


