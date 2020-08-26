# Google earth engine JS Cloud Functions

This package provides a simulation of Google Cloud Functions to test on you local machine.

Requirements:

* Unix system with bash or sh
* Docker
* Docker compose
* A Google cloud account (and project) with IAM permissions
* Google earth engine account

## Instructions

1. Create a Google Cloud service account for your project, see [service accounts](https://cloud.google.com/iam/docs/service-accounts).

2. Download the service account credentials and save to `credentials.json` in the root of this directory.

3. Register the service account to use Earth Engine, using [this page](https://signup.earthengine.google.com/#!/service_accounts).

4. Copy (or clone) your earthengine functions to `helper_functions.js`
   * add `const ee = require('@google/earthengine');` to the start of this file.
   * If you use a different file name or add more files you need to update the `Dockerfile`: ```COPY package.json package-lock.json credentials.json index.js helper_functions.js ./``` and `index.js`: ```const hfs = require('./helper_functions.js')```.
   * It is best practice to fully document and test your main functions.

5. Edit the `index.js` file;
   1. Define which parameters are passed from the REST query (and optionally give defaults or errors), in the section `REST WRAPPER` >> `PARAMETERS`.
   2. Add your analysis code in `REST WRAPPER` >> `ANALYSIS` >> `ANALYSIS CODE`
      * For debugging you can use asyncrouous printing of ee objects to console. Note for feature collections you may need to use `.limit()` to see results.
      * Usually it is best practice to convert the params to ee objects for use in functions.
      * Calling `ee.imageCollection`, `ee.image` and `ee.featureCollection` via dictionary selectors can cause problems, consider using switch.

6. Start the application by cd'ing to this directory, opening a terminal, and runnning: `sh ./start.sh dev`

7. Either go to the local URL shown in the terminal or use another terminal with [curl](https://curl.haxx.se/) or a tool such as [POSTMAN](https://www.postman.com/).
   * Using a browser the form of the call is: `URL?param1=value&param2=value`.
   * Using curl the form of the call is: `URL\?param1=value&param2=value`.
