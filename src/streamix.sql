CREATE TABLE artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name varchar(255) NOT NULL UNIQUE,
    img BLOB
);

CREATE TABLE albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_id INTEGER NOT NULL REFERENCES artists(id),

    name varchar(255) NOT NULL UNIQUE,
    img BLOB
);

CREATE TABLE tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    album_id INTEGER NOT NULL REFERENCES albums(id),

    name varchar(255) NOT NULL,
    number INT NOT NULL,
    path varchar(255) NOT NULL,

    duration REAL NOT NULL,
    bitrate REAL,
    sample_rate INT NOT NULL,
    num_blocks INT NOT NULL
);

CREATE TABLE track_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL REFERENCES tracks(id),
    format TINYINT NOT NULL,
    duration REAL NOT NULL,

    block_index INT NOT NULL,
    num_frames INT NOT NULL,
    block_size INT NOT NULL,
    block_data BLOB NOT NULL
);