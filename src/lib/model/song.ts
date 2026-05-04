// Mirrors YunYunLoader/ModdedScoreData.cs and ModdedLevelData.cs (the JSON-faced fields).
// The loader rejects ANY null field via reflection, so non-emptiness here is load-bearing.

export interface SongLevelRef {
  Editor: string;
  Difficulty: number;
  Path: string;
}

export interface SongJson {
  ID: string;
  Audio: string;
  Title: string;
  Artist: string;
  Lyricist: string;
  Composer: string;
  Arranger: string;
  Levels: SongLevelRef[];
}

export function emptySong(): SongJson {
  return {
    ID: '',
    Audio: '',
    Title: '',
    Artist: '',
    Lyricist: '',
    Composer: '',
    Arranger: '',
    Levels: [],
  };
}
