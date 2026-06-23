import { Club } from "@/types/tournament";

export const sortClubsByStarsDesc = (clubs: Club[]): Club[] =>
  [...clubs].sort((a, b) => {
    if (b.stars !== a.stars) return b.stars - a.stars;
    return a.name.localeCompare(b.name);
  });

