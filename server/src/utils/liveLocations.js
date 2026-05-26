const liveLocations = new Map();

// Pre-populate with default coordinates in Germany for the two teams in the database
// so they appear immediately when loading the map even if no real device has reported yet.
liveLocations.set('team-instaladores-a', {
    latitude: 49.8358,
    longitude: 8.0163,
    username: 'Sistema (Demo)',
    updatedAt: new Date()
});

liveLocations.set('73b38b95-f1ec-46c2-a302-209846c6c414', {
    latitude: 49.8250,
    longitude: 8.0300,
    username: 'Sistema (Demo)',
    updatedAt: new Date()
});

module.exports = liveLocations;
