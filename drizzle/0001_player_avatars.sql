CREATE TABLE player_avatars(player TEXT PRIMARY KEY REFERENCES players(id), avatar TEXT NOT NULL);
