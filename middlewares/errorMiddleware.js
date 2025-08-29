const errorMiddleware = (err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  };
  
  export default errorMiddleware;