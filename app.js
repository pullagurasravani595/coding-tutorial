const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let dataBase = null;

const initializeDbAndServer = async () => {
  try {
    dataBase = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server run at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
  }
};
initializeDbAndServer();
const dbObjectToResponse = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};
const stateDbToResponse = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

//API 1
app.post("/login/", async (request, response) => {
  try {
    const { username, password } = request.body;
    const userQuery = `
        SELECT * FROM user WHERE username = '${username}';`;
    const dbUser = await dataBase.get(userQuery);
    if (dbUser === undefined) {
      response.status(400);
      response.send(`Invalid user`);
    } else {
      isMatchedPassword = await bcrypt.compare(password, dbUser.password);
      if (isMatchedPassword === true) {
        let jwtToken;
        const payload = {
          username: username,
        };
        jwtToken = jwt.sign(payload, "My_Secret_Token");
        const token = {
          jwtToken: jwtToken,
        };
        response.status(200);
        response.send(token);
      } else {
        response.status(400);
        response.send("Invalid password");
      }
    }
  } catch (e) {
    console.log(`error: ${e.message}`);
  }
});

//Authentication with Token
const authenticationToken = (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (authHeader === undefined) {
    response.status(401);
    response.send(`Invalid JWT Token`);
  } else {
    jwt.verify(jwtToken, "My_Secret_Token", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send(`Invalid JWT Token`);
      } else {
        next();
      }
    });
  }
};
//API2
app.get("/states/", authenticationToken, async (request, response) => {
  const statesQuery = `
        SELECT * FROM state ORDER BY state_id;`;
  const stateArray = await dataBase.all(statesQuery);
  response.send(stateArray.map((eachObject) => stateDbToResponse(eachObject)));
});
//Api3
app.get("/states/:stateId", authenticationToken, async (request, response) => {
  try {
    const { stateId } = request.params;
    const stateQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
    const getState = await dataBase.get(stateQuery);
    response.send(stateDbToResponse(getState));
  } catch (e) {
    console.log(`error: ${e.message}`);
  }
});

//API4
app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictUser = `
        INSERT INTO 
            district (district_name, state_id, cases, cured, active, deaths)
        VALUES (
            '${districtName}',
            ${stateId},
            ${cases},
            ${cured},
            ${active},
            ${deaths});`;
  await dataBase.run(addDistrictUser);
  response.send(`District Successfully Added`);
});

app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    try {
      const { districtId } = request.params;
      const districtQuery = `SELECT * FROM district WHERE district_id = ${districtId};`;
      const details = await dataBase.get(districtQuery);
      response.send(dbObjectToResponse(details));
    } catch (e) {
      console.log(`error: ${e.message}`);
    }
  }
);
//API6
app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    try {
      const { districtId } = request.params;
      const removeQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
      response.send("District Removed");
    } catch (e) {
      console.log(`error: ${e.message}`);
    }
  }
);
//api7
app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    try {
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
            WHERE district_id = ${districtId};`;
      await dataBase.run(updateQuery);
      response.send("District Details Updated");
    } catch (e) {
      console.log(`error: ${e.message}`);
    }
  }
);
//api8
app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    try {
      const { stateId } = request.params;
      const statesQuery = `
            SELECT
                SUM(cases) AS totalCases,
                SUM(cured) AS totalCured,
                SUM(active) AS totalActive,
                SUM(deaths) AS totalDeaths
            FROM district
            WHERE state_id = ${stateId};`;
      const arrayDetails = await dataBase.get(statesQuery);
      response.send(arrayDetails);
    } catch (e) {
      console.log(`error: ${e.message}`);
    }
  }
);

module.exports = app;
