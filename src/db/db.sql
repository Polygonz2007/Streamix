
CREATE TABLE user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username varchar(63) NOT NULL UNIQUE,
    password varchar(255) NOT NULL
);

CREATE TABLE creator (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name varchar(255) NOT NULL,
    creator_type TINYINT NOT NULL REFERENCES creator_type(id),
    user_id INTEGER REFERENCES user(id)
);

CREATE TABLE creator_type (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name varchar(255) NOT NULL UNIQUE
);

CREATE TABLE collection (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name varchar(255),
    creator_id INTEGER NOT NULL REFERENCES creator(id),
    collection_type TINYINT NOT NULL REFERENCES collection_type(id)
);

CREATE TABLE collection_type (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name varchar(255) NOT NULL UNIQUE
);

CREATE TABLE track (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name varchar(255),
    
    number INTEGER,
    disc INTEGER,
    duration REAL NOT NULL,
    released DATE
);

CREATE TABLE track_collection (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL REFERENCES track(id),
    collection_id INTEGER NOT NULL REFERENCES collection(id),
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

    lossy TINYINT NOT NULL,
    bitrate INTEGER,
    samplerate INTEGER,
    bitdepth INTEGER
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

INSERT INTO format(name, level, lossy, bitrate, samplerate, bitdepth) VALUES
("FLAC Max",     3, 0, null, 96000, 24),
("FLAC HD",      2, 0, null, 48000, 24),
("FLAC CD",      1, 0, null, 44100, 16),
("Opus Max",     0, 1, 384,  null,  null),
("Opus High",   -1, 1, 192,  null,  null),
("Opus Medium", -2, 1, 96,   null,  null),
("Opus Low",    -3, 1, 48,   null,  null)
