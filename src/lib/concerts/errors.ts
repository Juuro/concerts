/** Thrown when the user already has this concert in their list (matched by date/location/headliner). */
export class ConcertAlreadyExistsError extends Error {
  constructor(public concertId: string) {
    super("Concert already in list")
    this.name = "ConcertAlreadyExistsError"
  }
}
