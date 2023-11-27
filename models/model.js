const {db,pool} = require('../config/connection');
//some simple model functions
async function getAllCompetitors() {
  const result = await db.query('SELECT * FROM competitors');
  return result.rows;
}

async function getOneCompetitor(id) {
  console.log(id);
  const result = await db.query('SELECT * FROM competitors WHERE id = $1', [id]);
  console.log(result.rows)
  return result.rows[0];
}

async function getOneTournament(id) {
  const result = await db.query('SELECT * FROM tournaments WHERE id = $1', [id]);
  return result.rows[0];
}

async function createTournament(tournament) {
  try {
      // Insert tournament
      const tournamentValue = [tournament.name, parseInt(tournament.num_comp)];
      const tournamentResult = await db.query(`
          INSERT INTO tournaments (name, num_comp)
          VALUES ($1, $2) RETURNING *`,
          tournamentValue
      );
      const tournamentData = tournamentResult.rows[0];

      // Insert competitors
      const competitorPromises = tournament.comp_name.map(player => 
          db.query(`
              INSERT INTO competitors (comp_name, tournament_id)
              VALUES ($1, $2) RETURNING *`,
              [player, tournamentData.id]
          )
      );
      const competitorResults = await Promise.all(competitorPromises);
      const competitorsData = competitorResults.map(res => res.rows[0]);

      // Process matches
      let matchData = [];
      let n = competitorsData.length;
      for (let i = 0; i < n; i += 2) {
          if (i + 1 < competitorsData.length) {
              const matchResult = await matches(competitorsData[i].id, competitorsData[i + 1].id, tournamentData.id, i / 2);
              matchData.push(matchResult);
          }
      }

      // Add dummy match if needed
      matchData.push(await dummyMatches(tournamentData.id, 2));
      return { tournamentData, competitorsData, matchData };
  } catch (err) {
      console.error("Error in createTournament function:", err);
      throw err;
  }
}

async function matches(player1, player2, tournamentId, round) {
  const matchResult = await db.query(`
      INSERT INTO matches (comp_a_id, comp_b_id, tournament_id, round_id)
      VALUES ($1, $2, $3, $4) RETURNING *`,
      [player1, player2, tournamentId, round]
  );
  return matchResult.rows[0];
}

async function dummyMatches(tournamentId, round) {
  const dummyMatchResult = await db.query(`
      INSERT INTO matches (comp_a_id, comp_b_id, tournament_id, round_id)
      VALUES (1, 1, $1, $2) RETURNING *`,
      [tournamentId, round]
  );
  return dummyMatchResult.rows[0];
}


async function buildBracket(id) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Start the transaction

        // Query 1: Select from tournaments and competitors
        const tournamentsAndCompetitors = await client.query(`
        SELECT * FROM tournaments
        JOIN competitors
        ON competitors.tournament_id = tournaments.id
        WHERE tournaments.id = $1`, [id]);

        // Query 2: Placeholder for your matches query
        const matches = await client.query(`
        WITH selection1 AS
        (SELECT competitors.comp_name AS name1, matches.tournament_id AS tourney, matches.round_id AS round, matches.id AS matchey
          FROM matches JOIN competitors ON matches.comp_a_id = competitors.id),
        selection2 AS
        (SELECT competitors.comp_name AS name2, matches.tournament_id AS tourney, matches.round_id AS round, matches.id AS matchey
          FROM matches JOIN competitors ON matches.comp_b_id = competitors.id)
        SELECT * FROM selection1 JOIN selection2 ON selection2.matchey = selection1.matchey WHERE selection1.tourney = $1
        ORDER BY selection1.round ASC
            `, [id]);

        // Query 3: Select the tournament champion
        const tournamentChampion = await client.query(`
        SELECT competitors.comp_name FROM competitors
        JOIN tournaments
        ON competitors.id = tournaments.tournament_champion
        WHERE tournaments.id = $1`, [id]);

        await client.query('COMMIT'); // Commit the transaction
        console.log({
          tournamentsAndCompetitors: tournamentsAndCompetitors.rows,
          matches: matches.rows,
          tournamentChampion: tournamentChampion.rows[0]
      })
        // Combine the results as needed
        return {
            tournamentsAndCompetitors: tournamentsAndCompetitors.rows,
            matches: matches.rows,
            tournamentChampion: tournamentChampion.rows[0]
        };
    } catch (error) {
        await client.query('ROLLBACK'); // Roll back the transaction in case of an error
        console.error("Error in buildBracket function:", error);
        throw error;
    } finally {
        client.release(); // Always release the client back to the pool
    }
}


async function getOneMatch(id) {
  const result = await db.query(`
  WITH selection1 AS
  (SELECT matches.comp_a_id AS S1a_id, competitors.comp_name AS name1, matches.tournament_id AS tourney, matches.round_id AS round, matches.id AS matchey
    FROM matches JOIN competitors ON matches.comp_a_id = competitors.id),
  selection2 AS
  (SELECT matches.comp_b_id AS S2b_id, competitors.comp_name AS name2, matches.tournament_id AS tourney, matches.round_id AS round, matches.id AS matchey
    FROM matches JOIN competitors ON matches.comp_b_id = competitors.id)
  SELECT * FROM selection1 JOIN selection2 ON selection2.matchey = selection1.matchey WHERE selection1.matchey = $1`, [id]);
  return result.rows[0];
}

async function updateFinalRound(data) {
  console.log("updating results",data)
  if ( data.round === '0') {
    return db.query(`
      UPDATE matches
      SET comp_a_id = $1
      WHERE tournament_id = $2 and matches.round_id = 2
      RETURNING *`,
      [data.winner, data.tournament_id]);
  } else if (data.round === '1') {
    return db.query(`
      UPDATE matches
      SET comp_b_id = $1
      WHERE tournament_id = $2 and matches.round_id = 2
      RETURNING *`,
      [data.winner, data.tournament_id]);
  } else if (data.round === '2') {
    return db.query(`
      UPDATE tournaments
      SET tournament_champion = $1
      WHERE id = $2 RETURNING *`,
      [data.winner, data.tournament_id])
  }
}

async function destroy(id) {
  console.log('about to delete');
  const result = await db.query('DELETE FROM tournaments WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
}

module.exports = {
  getAllCompetitors: getAllCompetitors,
  getOneCompetitor: getOneCompetitor,
  getOneTournament: getOneTournament,
  createTournament: createTournament,
  buildBracket: buildBracket,
  getOneMatch: getOneMatch,
  updateFinalRound: updateFinalRound,
  destroy: destroy

}
