CREATE TABLE artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name varchar(255) NOT NULL UNIQUE,
    img BLOB
);

CREATE TABLE albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_id INTEGER NOT NULL REFERENCES artists(id),

    name varchar(255) NOT NULL UNIQUE,
    img BLOB,
    year INT
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

CREATE TABLE track_artists ( -- If a track is made by multiple artists (not the same as album_artist) this table tells you who made the song
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL REFERENCES tracks(id),
    artist_id INTEGER NOT NULL REFERENCES artists(id)
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

CREATE INDEX track_data_i1 ON track_data(track_id);
--CREATE INDEX track_data_i2 ON track_data(block_index)

-- Search
CREATE VIRTUAL TABLE search_index USING fts5 (
    track,
    album,
    artist,
    track_id UNINDEXED,
    prefix='2 3 4 5'
);

-- Database status (for now, just for debug. a more proper system later)
CREATE TABLE errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type varchar(64),
    file varchar(255),
    description varchar(255)
);