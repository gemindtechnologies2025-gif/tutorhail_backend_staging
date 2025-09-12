let fs = require('fs');
let _ = require('lodash');
let exec = require('child_process').exec;
let path = require("path");
const aws = require("aws-sdk");
aws.config.update({
  secretAccessKey: process.env.AWS_SECRET,
  accessKeyId: process.env.AWS_KEY
});
let s3 = new aws.S3();
let dbOptions = {
  host: '0.0.0.0',
  port: 27017,
  database: process.env.DATABASE_NAME,
  autoBackup: true,
  removeOldBackup: true,
  keepLastDaysBackup: 2,
  autoBackupPath: "./database-backup/" // i.e. /var/database-backup/
};

/* return if variable is empty or not. */
async function empty(mixedVar) {
  let undef, key, i, len;
  let emptyValues = [undef, null, false, 0, '', '0'];
  for (i = 0, len = emptyValues.length; i < len; i++) {
    if (mixedVar === emptyValues[i]) {
      return true;
    }
  }
  if (typeof mixedVar === 'object') {
    for (key in mixedVar) {
      if (mixedVar[key]) return false;
    }
    return true;
  }
  return false;
}

// Auto backup script
const uploadDir = function (s3Path) {
  function walkSync(currentDirPath, callback) {
    fs.readdirSync(currentDirPath).forEach(function (name) {
      let filePath = path.join(currentDirPath, name);
      let stat = fs.statSync(filePath);
      if (stat.isFile()) {
        callback(filePath, stat);
      } else if (stat.isDirectory()) {
        walkSync(filePath, callback);
      }
    });
  }
  walkSync(s3Path, function (filePath) {
    let bucketPath = filePath.substring(24);
    let params = {
      Bucket: process.env.AWS_BUCKET,
      Key: bucketPath,
      Body: fs.readFileSync(filePath)
    };
    s3.putObject(params, function (err) {
      if (err) {
        console.log(err);
      }
    });
  });
};

function removeDir(fileName, callback) {
  let params = {
    Bucket: process.env.AWS_BUCKET,
    Prefix: fileName
  };

  s3.listObjects(params, function (err, data) {
    if (err) {
      console.log(err);
      return false;
    }
    if (data.Contents.length == 0) {
      console.log("NO data");
      return false;
    }

    params = {
      Bucket: process.env.AWS_BUCKET
    };
    params.Delete = {
      Objects: []
    };

    data.Contents.forEach(function (content) {
      params.Delete.Objects.push({
        Key: content.Key
      });
    });

    s3.deleteObjects(params, function (err, data) {
      if (err) {
        console.log(err);
        return false;
      }
      if (data.IsTruncated) {
        removeDir(fileName, callback);
      } else {
        console.log("Done");
        return true;
      }
    });
  });
}

//Backup
module.exports.dbAutoBackUp = async function () {
  if (dbOptions.autoBackup == true) {
    let date = new Date();
    let beforeDate, oldBackupDir, oldBackupPath;
    let newBackupDir = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
    let newBackupPath = dbOptions.autoBackupPath + 'mongodumpLive-' + newBackupDir;

    if (dbOptions.removeOldBackup == true) {
      beforeDate = _.clone(date);
      beforeDate.setDate(beforeDate.getDate() - dbOptions.keepLastDaysBackup);
      oldBackupDir = beforeDate.getFullYear() + '-' + (beforeDate.getMonth() + 1) + '-' + beforeDate.getDate();
      oldBackupPath = dbOptions.autoBackupPath + 'mongodumpLive-' + oldBackupDir;
    }
    let cmd = 'mongodump --host ' + dbOptions.host + ' --port ' + dbOptions.port + ' --db ' + dbOptions.database + ' --out ' + newBackupPath;
    exec(cmd, async function (error) {
      if (empty(error)) {
        console.log(error, "hjxjhcgjcgd");
      }
      if (dbOptions.removeOldBackup == true) {
        await removeDir("mongodumpLive-" + oldBackupDir + "/");
        console.log("remove", oldBackupPath);
        if (fs.existsSync(oldBackupPath)) {
          exec("rm -rf " + oldBackupPath, function (err) {
            if (err) {
              console.log(err);
            } else {
              console.log("Done--");
            }
          });
        }
      }
      await uploadDir('./database-backup/' + 'mongodumpLive-' + newBackupDir);
    });
  }
};