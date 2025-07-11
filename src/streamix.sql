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

    length REAL NOT NULL,
    bitrate REAL
);