const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
  }
};

initializeDbAndServer();

//Covert Snake To Camel Case
const snakeToCamelCase = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

//Authenticate Token
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const getUserQuery = `
    SELECT * 
    FROM 
        user
    WHERE 
        username = '${username}';
    `;

  const dbUser = await db.get(getUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    isPasswordMatch = await bcrypt.compare(password, dbUser.password);

    if (isPasswordMatch) {
      const payload = { username };
      const jwtToken = jwt.sign(payload, "SECRET");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
    SELECT * 
    FROM 
        state
    ORDER BY
        state_id
    `;

  const statesArray = await db.all(getStatesQuery);
  response.send(statesArray.map((eachItem) => snakeToCamelCase(eachItem)));
});

//API 3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;

  const getStateQuery = `
    SELECT * 
    FROM
        state
    WHERE 
        state_id = ${stateId};
    `;

  const state = await db.get(getStateQuery);
  response.send(snakeToCamelCase(state));
});

//API 4
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;

  const addDistrictQuery = `
        INSERT INTO 
        district(district_name, state_id, cases, cured, active, deaths)
        VALUES (
            '${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths}
        );
    `;
  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

//API 5
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;

    const getDistrict = `
    SELECT *
    FROM 
         district
    WHERE 
        district_id = ${districtId};
    `;

    const district = await db.get(getDistrict);
    response.send(snakeToCamelCase(district));
  }
);
//API 6
app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `
    DELETE FROM
    district
    WHERE 
        district_id  = ${districtId};
    `;

    await db.run(deleteQuery);
    response.send("District Removed");
  }
);

//API 7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const { districtId } = request.params;
    const updateQuery = `
    UPDATE district
    SET 
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
    WHERE 
        district_id = ${districtId};
    `;

    await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;

    const getStatsQuery = `
    SELECT
        SUM(cases) AS totalCases,
        SUM(cured) AS totalCured,
        SUM(active) AS totalActive,
        SUM(deaths) AS totalDeaths
    FROM 
        district
    WHERE 
        state_id = ${stateId}
    GROUP BY 
        state_id
    `;

    const stats = await db.get(getStatsQuery);
    response.send(stats);
  }
);

//Export the express instance(app)
module.exports = app;
