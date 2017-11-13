const tape = require('tape');
const request = require('superagent');
const fs = require('fs');
const path = require('path');
const temp = require('temp').track();
const _ = require('lodash');
const archiver = require('archiver');

tape('arcgis tests', test => {
  test.test('fields and sample results', t => {

    const mock_arcgis_app = require('express')();
    mock_arcgis_app.get('/MapServer/0', (req, res, next) => {
      t.equals(req.query.f, 'json');

      res.status(200).send({
        fields: [
          {
            name: 'field 1'
          },
          {
            name: 'field 2'
          }
        ]
      });

    });

    mock_arcgis_app.get('/MapServer/0/query', (req, res, next) => {
      t.equals(req.query.outFields, '*');
      t.equals(req.query.where, '1=1');
      t.equals(req.query.resultRecordCount, '10');
      t.equals(req.query.resultOffset, '0');

      res.status(200).send({
        features: [
          {
            attributes: {
              attribute1: 'feature 1 attribute 1 value',
              attribute2: 'feature 1 attribute 2 value'
            }
          },
          {
            attributes: {
              attribute1: 'feature 2 attribute 1 value',
              attribute2: 'feature 2 attribute 2 value'
            }
          }
        ]
      });

    });

    const mock_arcgis_server = mock_arcgis_app.listen();

    const mod_app = require('../app')();
    const mod_server = mod_app.listen();

    request
      .get(`http://localhost:${mod_server.address().port}/fields`)
      .accept('json')
      .query({
        source: `http://localhost:${mock_arcgis_server.address().port}/MapServer/0`
      })
      .end((err, response) => {
        t.equals(response.statusCode, 200);
        t.deepEquals(JSON.parse(response.text), {
          type: 'ESRI',
          fields: ['field 1', 'field 2'],
          results: [
            {
              attribute1: 'feature 1 attribute 1 value',
              attribute2: 'feature 1 attribute 2 value'
            },
            {
              attribute1: 'feature 2 attribute 1 value',
              attribute2: 'feature 2 attribute 2 value'
            }
          ]
        });

        t.end();
        mock_arcgis_server.close();
        mod_server.close();
      });

  });

});

tape('geojson tests', test => {
  test.test('fields and sample results, should limit to 10', t => {

    const mock_geojson_app = require('express')();
    mock_geojson_app.get('/file.geojson', (req, res, next) => {
      res.status(200).send({
        type: 'FeatureCollection',
        features: _.range(11).reduce((features, i) => {
          features.push({
            type: 'Feature',
            properties: {
              'attribute 1': `feature ${i} attribute 1 value`,
              'attribute 2': `feature ${i} attribute 2 value`
            }
          });
          return features;
        }, [])
      });

    });

    const mock_geojson_server = mock_geojson_app.listen();

    const mod_app = require('../app')();
    const mod_server = mod_app.listen();

    request
      .get(`http://localhost:${mod_server.address().port}/fields`)
      .accept('json')
      .query({
        source: `http://localhost:${mock_geojson_server.address().port}/file.geojson`
      })
      .end((err, response) => {
        t.equals(response.statusCode, 200);
        t.deepEquals(JSON.parse(response.text), {
          type: 'geojson',
          fields: ['attribute 1', 'attribute 2'],
          results: _.range(10).reduce((features, i) => {
            features.push({
              'attribute 1': `feature ${i} attribute 1 value`,
              'attribute 2': `feature ${i} attribute 2 value`
            });
            return features;
          }, [])
        });

        t.end();
        mock_geojson_server.close();
        mod_server.close();
      });

  });

  test.test('fields and sample results, only 2 available', t => {

    const mock_geojson_app = require('express')();
    mock_geojson_app.get('/file.geojson', (req, res, next) => {
      res.status(200).send({
        type: 'FeatureCollection',
        features: _.range(2).reduce((features, i) => {
          features.push({
            type: 'Feature',
            properties: {
              'attribute 1': `feature ${i} attribute 1 value`,
              'attribute 2': `feature ${i} attribute 2 value`
            }
          });
          return features;
        }, [])
      });

    });

    const mock_geojson_server = mock_geojson_app.listen();

    const mod_app = require('../app')();
    const mod_server = mod_app.listen();

    request
      .get(`http://localhost:${mod_server.address().port}/fields`)
      .accept('json')
      .query({
        source: `http://localhost:${mock_geojson_server.address().port}/file.geojson`
      })
      .end((err, response) => {
        t.equals(response.statusCode, 200);
        t.deepEquals(JSON.parse(response.text), {
          type: 'geojson',
          fields: ['attribute 1', 'attribute 2'],
          results: _.range(2).reduce((features, i) => {
            features.push({
              'attribute 1': `feature ${i} attribute 1 value`,
              'attribute 2': `feature ${i} attribute 2 value`
            });
            return features;
          }, [])
        });

        t.end();
        mock_geojson_server.close();
        mod_server.close();
      });

  });

});

tape('geojson.zip tests', test => {
  test.test('fields and sample results, should limit to 10', t => {

    const mock_geojson_app = require('express')();
    mock_geojson_app.get('/file.geojson.zip', (req, res, next) => {
      const output = fs.createWriteStream(__dirname + '/example.zip');

      output.on('close', function() {
        const zipContents = fs.readFileSync(__dirname + '/example.zip');

        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', 'attachment; filename=file.geojson.zip');
        res.set('Content-Length', zipContents.length);
        res.end(zipContents, 'binary');

      });

      const data = {
        type: 'FeatureCollection',
        features: _.range(11).reduce((features, i) => {
          features.push({
            type: 'Feature',
            properties: {
              'attribute 1': `feature ${i} attribute 1 value`,
              'attribute 2': `feature ${i} attribute 2 value`
            }
          });
          return features;
        }, [])
      }

      const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
      });
      archive.pipe(output);
      archive.append(JSON.stringify(data, null, 2), { name: 'file1.txt' });
      archive.finalize();

    });

    const mock_geojson_server = mock_geojson_app.listen();

    const mod_app = require('../app')();
    const mod_server = mod_app.listen();

    request
      .get(`http://localhost:${mod_server.address().port}/fields`)
      .accept('json')
      .query({
        source: `http://localhost:${mock_geojson_server.address().port}/file.geojson.zip`
      })
      .end((err, response) => {
        t.equals(response.statusCode, 200);
        t.deepEquals(JSON.parse(response.text), {
          type: 'geojson.zip',
          fields: ['attribute 1', 'attribute 2'],
          results: _.range(10).reduce((features, i) => {
            features.push({
              'attribute 1': `feature ${i} attribute 1 value`,
              'attribute 2': `feature ${i} attribute 2 value`
            });
            return features;
          }, [])
        });

        t.end();
        mock_geojson_server.close();
        mod_server.close();
      });

  });

  test.test('fields and sample results, should limit to 10', t => {

    const mock_geojson_app = require('express')();
    mock_geojson_app.get('/file.geojson.zip', (req, res, next) => {
      const output = fs.createWriteStream(__dirname + '/example.zip');

      output.on('close', function() {
        const zipContents = fs.readFileSync(__dirname + '/example.zip');

        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', 'attachment; filename=file.geojson.zip');
        res.set('Content-Length', zipContents.length);
        res.end(zipContents, 'binary');

      });

      output.on('end', function() {
        console.error('Data has been drained');

      });

      const data = {
        type: 'FeatureCollection',
        features: _.range(2).reduce((features, i) => {
          features.push({
            type: 'Feature',
            properties: {
              'attribute 1': `feature ${i} attribute 1 value`,
              'attribute 2': `feature ${i} attribute 2 value`
            }
          });
          return features;
        }, [])
      }

      const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
      });
      archive.pipe(output);
      archive.append(JSON.stringify(data, null, 2), { name: 'file1.txt' });
      archive.finalize();

    });

    const mock_geojson_server = mock_geojson_app.listen();

    const mod_app = require('../app')();
    const mod_server = mod_app.listen();

    request
      .get(`http://localhost:${mod_server.address().port}/fields`)
      .accept('json')
      .query({
        source: `http://localhost:${mock_geojson_server.address().port}/file.geojson.zip`
      })
      .end((err, response) => {
        t.equals(response.statusCode, 200);
        t.deepEquals(JSON.parse(response.text), {
          type: 'geojson.zip',
          fields: ['attribute 1', 'attribute 2'],
          results: _.range(2).reduce((features, i) => {
            features.push({
              'attribute 1': `feature ${i} attribute 1 value`,
              'attribute 2': `feature ${i} attribute 2 value`
            });
            return features;
          }, [])
        });

        t.end();
        mock_geojson_server.close();
        mod_server.close();
      });

  });

});

tape('csv tests', test => {
  test.test('fields and sample results, should limit to 10', t => {

    const mock_geojson_app = require('express')();
    mock_geojson_app.get('/file.csv', (req, res, next) => {
      const rows = _.range(20).reduce((rows, i) => {
        return rows.concat(`feature ${i} attribute 1 value,feature ${i} attribute 2 value`);
      }, ['attribute 1,attribute 2']);

      res.status(200).send(rows.join('\n'));

    });

    const mock_geojson_server = mock_geojson_app.listen();

    const mod_app = require('../app')();
    const mod_server = mod_app.listen();

    request
      .get(`http://localhost:${mod_server.address().port}/fields`)
      .accept('json')
      .query({
        source: `http://localhost:${mock_geojson_server.address().port}/file.csv`
      })
      .end((err, response) => {
        t.equals(response.statusCode, 200);
        t.deepEquals(JSON.parse(response.text), {
          type: 'csv',
          fields: ['attribute 1', 'attribute 2'],
          results: _.range(10).reduce((features, i) => {
            features.push({
              'attribute 1': `feature ${i} attribute 1 value`,
              'attribute 2': `feature ${i} attribute 2 value`
            });
            return features;
          }, [])
        });

        t.end();
        mock_geojson_server.close();
        mod_server.close();
      });

  });

  test.test('csv consisting of less than 10 records should return all', t => {

    const mock_geojson_app = require('express')();
    mock_geojson_app.get('/file.csv', (req, res, next) => {
      const rows = _.range(2).reduce((rows, i) => {
        return rows.concat(`feature ${i} attribute 1 value,feature ${i} attribute 2 value`);
      }, ['attribute 1,attribute 2']);

      res.status(200).send(rows.join('\n'));

    });

    const mock_geojson_server = mock_geojson_app.listen();

    const mod_app = require('../app')();
    const mod_server = mod_app.listen();

    request
      .get(`http://localhost:${mod_server.address().port}/fields`)
      .accept('json')
      .query({
        source: `http://localhost:${mock_geojson_server.address().port}/file.csv`
      })
      .end((err, response) => {
        t.equals(response.statusCode, 200);
        t.deepEquals(JSON.parse(response.text), {
          type: 'csv',
          fields: ['attribute 1', 'attribute 2'],
          results: _.range(2).reduce((features, i) => {
            features.push({
              'attribute 1': `feature ${i} attribute 1 value`,
              'attribute 2': `feature ${i} attribute 2 value`
            });
            return features;
          }, [])
        });

        t.end();
        mock_geojson_server.close();
        mod_server.close();
      });

  });

});

tape('csv.zip tests', test => {
  test.test('fields and sample results, should limit to 10', t => {

    const mock_geojson_app = require('express')();
    mock_geojson_app.get('/file.csv.zip', (req, res, next) => {
      const output = fs.createWriteStream(__dirname + '/example.zip');

      output.on('close', function() {
        const zipContents = fs.readFileSync(__dirname + '/example.zip');

        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', 'attachment; filename=file.csv.zip');
        res.set('Content-Length', zipContents.length);
        res.end(zipContents, 'binary');

      });

      const data = _.range(20).reduce((rows, i) => {
        return rows.concat(`feature ${i} attribute 1 value,feature ${i} attribute 2 value`);
      }, ['attribute 1,attribute 2']);

      const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
      });
      archive.pipe(output);
      archive.append(data.join('\n'), { name: 'file1.csv' });
      archive.finalize();

    });

    const mock_geojson_server = mock_geojson_app.listen();

    const mod_app = require('../app')();
    const mod_server = mod_app.listen();

    request
      .get(`http://localhost:${mod_server.address().port}/fields`)
      .accept('json')
      .query({
        source: `http://localhost:${mock_geojson_server.address().port}/file.csv.zip`
      })
      .end((err, response) => {
        t.equals(response.statusCode, 200);
        t.deepEquals(JSON.parse(response.text), {
          type: 'csv.zip',
          fields: ['attribute 1', 'attribute 2'],
          results: _.range(10).reduce((features, i) => {
            features.push({
              'attribute 1': `feature ${i} attribute 1 value`,
              'attribute 2': `feature ${i} attribute 2 value`
            });
            return features;
          }, [])
        });

        t.end();
        mock_geojson_server.close();
        mod_server.close();
      });

  });

});
