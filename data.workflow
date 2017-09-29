; /usr/bin/drake
;
; This file describes and performs the data processing
; workflow using Drake, a Make-like format focused on data.
; https://github.com/Factual/drake
;
; Full documentation (suggested to switch to Viewing mode)
; https://docs.google.com/document/d/1bF-OKNLIG10v_lMes_m4yyaJtAaJKtdK0Jizvi_MNsg/
;
; Suggested groups/tags of tasks:
; Download, Convert, Combine, Analysis, and Export
;
; Run with: drake -w data.workflow
;


; Base directory for all inputs and output
BASE=data


; Download file. Using the %download tag, we can download
; all things with drake %download
sources/st-paul-vacant-lots.csv, %download <- [-timecheck]
  mkdir -p $BASE/sources
  wget -O $OUTPUT "https://information.stpaul.gov/api/views/rfbb-x7za/rows.csv?accessType=DOWNLOAD"

; Census data
sources/st-paul-acs-tracts-race-poverty-income-renter.zip, %download <- [-timecheck]
  mkdir -p $BASE/sources
  wget -O $OUTPUT "https://api.censusreporter.org/1.0/data/download/latest?table_ids=B02001,B17001,B19001,B25003&geo_ids=140|16000US2758000&format=geojson"



; Unarchive
sources/acs2015_5yr_B02001_14000US27123030900/acs2015_5yr_B02001_14000US27123030900.geojson, sources/acs2015_5yr_B02001_14000US27123030900/metadata.json, %convert <- sources/st-paul-acs-tracts-race-poverty-income-renter.zip
  unzip -o $INPUT -d $BASE/sources


; Run analysis on vacant lots
%vacant-lots.analysis, %analysis <- sources/st-paul-vacant-lots.csv, sources/acs2015_5yr_B02001_14000US27123030900/acs2015_5yr_B02001_14000US27123030900.geojson, sources/acs2015_5yr_B02001_14000US27123030900/metadata.json
  node $BASE/lib/vacant-lots.js $INPUT $INPUT1 $INPUT2


; Cleanup tasks
%sources.cleanup, %cleanup, %WARNING <-
  rm -rv $BASE/sources/*
%build.cleanup, %cleanup, %WARNING <-
  rm -rv $BASE/build/*
