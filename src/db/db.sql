
CREATE TABLE user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username varchar(63) NOT NULL UNIQUE,
    password varchar(255) NOT NULL
);

CREATE TABLE creator (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name varchar(255) NOT NULL,
    type_id TINYINT NOT NULL REFERENCES creator_type(id),
    user_id INTEGER REFERENCES user(id)
);

CREATE TABLE creator_type (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name varchar(255) NOT NULL UNIQUE
);

CREATE TABLE collection (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name varchar(255),
    type_id TINYINT NOT NULL REFERENCES collection_type(id),
    creator_id INTEGER NOT NULL REFERENCES creator(id)
);

CREATE TABLE collection_type (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name varchar(255) NOT NULL UNIQUE
);

CREATE TABLE track (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name varchar(255),
    
    duration REAL NOT NULL,
    number INTEGER,
    disc INTEGER,
    released DATE
);

CREATE TABLE track_collection (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL REFERENCES track(id),
    collection_id INTEGER NOT NULL REFERENCES collection(id),
    position INTEGER NOT NULL,
    added TIMESTAMP DEFAULT (unixepoch('now'))
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
    lossy TINYINT NOT NULL,
    bitrate INTEGER,
    vbr TINYINT NOT NULL,
    samplerate INTEGER,
    bitdepth varchar(31)
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

INSERT INTO creator_type(name) VALUES ("User"), ("Artist"), ("Duo"), ("Band");
INSERT INTO collection_type(name) VALUES ("EP"), ("Album"), ("Playlist");

INSERT INTO format(name, level, lossy, vbr, bitrate, samplerate, bitdepth, encoder) VALUES
("FLAC Max",     3, 0, 0, null, 96000, "s32", "flac"),
("FLAC HD",      2, 0, 0, null, 48000, "s32", "flac"),
("FLAC CD",      1, 0, 0, null, 44100, "s16", "flac"),
("Opus Max",     0, 1, 1, 384,  48000,  null, "libopus"),
("Opus High",   -1, 1, 1, 192,  48000,  null, "libopus"),
("Opus Medium", -2, 1, 1, 96,   48000,  null, "libopus"),
("Opus Low",    -3, 1, 1, 48,   48000,  null, "libopus");
