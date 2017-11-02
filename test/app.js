const tape = require('tape');
const request = require('superagent');
const fs = require('fs');
const path = require('path');
const temp = require('temp').track();
const _ = require('lodash');

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
          type: 'arcgis',
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
        })

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

tape('csv tests', test => {
  test.test('fields and sample results, should limit to 10', t => {

    const mock_geojson_app = require('express')();
    mock_geojson_app.get('/file.csv', (req, res, next) => {
      const rows = _.range(11).reduce((rows, i) => {
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

});
