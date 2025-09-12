  "use strict";
  process.env.NODE_ENV = process.env.NODE_ENV ? process.env.NODE_ENV : "develop";
  require("dotenv").config({
    path: `.env.${process.env.NODE_ENV}`
  });
  const express = require("express");
  const cors = require("cors");
  const logger = require("morgan");
  const bodyParser = require("body-parser");
  const swaggerUi = require("swagger-ui-express");
  const YAML = require("yamljs");
  const helmet = require("helmet");
  const app = express();
  let server = require("http").createServer(app);
  const swaggerDocument = YAML.load('./swagger/collection.yml');
  const socket = require('./socket/index');
  const connection = require("./common/connection");
  const responses = require("./common/responses");
  const v1Routes = require("./v1/routes/index");
  const cron = require("./cron/cronjobs");
  const services = require("./services/index");

  app.use("/", express.static(__dirname + "/public"));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  //Allow cors policy
  app.use(cors());
  // app.use(
  //   "*",
  //   cors({
  //     allowedHeaders: ["sessionId", "Content-Type"],
  //     exposedHeaders: ["sessionId"],
  //     origin: "*",
  //     methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  //     preflightContinue: false
  //   })
  // );
  app.use(responses());
  app.use(helmet());
  app.use(logger("dev"));

  app.use(bodyParser.json({
    limit: "20mb"
  }));
  app.use(bodyParser.urlencoded({
    limit: "100mb",
    extended: true,
    parameterLimit: 50000
  }));

  app.use("/api/v1", v1Routes);

  // 404, Not Found
  app.use((req, res) => res.error(404, "NOT_FOUND"));

  app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Origin,X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
  });

  // Error handling
  app.use((error, req, res, next) => {
    console.error(error);
    next();
    return res.error(400, error.message || error);
  });
  //disable all console.log
  // console.log = () => { };

  // Listening & Initializing
  server.listen(process.env.PORT, async () => {
    console.log(`Environment:`, process.env.NODE_ENV);
    console.log(`Running on:`, process.env.PORT);
    console.log('start socketInitialize');
    cron.startCronJobs();
    const io = require('socket.io')(server, {
      cors: {
        origin: '*'
      }
    });
    socket(io);
    connection.mongodb();
    services.Swagger.createSwagger();
  });