(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/admin/students/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'Student',
        email: 'tom@myinstitute.com',
        dateOfBirth: '2000-01-01'
      })
    });
    console.log('STATUS', res.status);
    const text = await res.text();
    console.log('BODY');
    console.log(text);
  } catch (err) {
    console.error('ERROR', err);
  }
})();
