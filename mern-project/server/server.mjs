import app from "./app.mjs";

const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
