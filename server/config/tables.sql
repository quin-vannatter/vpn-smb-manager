CREATE TABLE IF NOT EXISTS USERS (
    USERNAME TEXT PRIMARY KEY,
    PASSWORD_HASH TEXT NOT NULL,
    SMB_PASSWORD TEXT NOT NULL,
    EXPIRATION_DATE TEXT,
    TOKEN TEXT,
    IS_ADMIN INTEGER
);

CREATE TABLE IF NOT EXISTS CERTIFICATES (
    ID TEXT NOT NULL,
    USERNAME TEXT,
    PRIMARY KEY (USERNAME, ID),
    FOREIGN KEY (USERNAME) REFERENCES USERS(USERNAME)
);

CREATE TABLE IF NOT EXISTS DEVICES (
    MAC TEXT PRIMARY KEY,
    NAME TEXT NOT NULL
)